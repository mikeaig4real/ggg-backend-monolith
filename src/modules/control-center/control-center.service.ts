import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ControlCenter,
  ControlCenterDocument,
} from './schemas/control-center.schema';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { CONTROL_CENTER_QUEUE } from '@app/common/constants/queues';
import { Queue } from 'bullmq';

@Injectable()
export class ControlCenterService implements OnModuleInit {
  private readonly logger = new Logger(ControlCenterService.name);

  private readonly cache = new Map<string, ControlCenterDocument>();

  constructor(
    @InjectModel(ControlCenter.name)
    private readonly controlCenterModel: Model<ControlCenterDocument>,
    private readonly configService: ConfigService,
    @InjectQueue(CONTROL_CENTER_QUEUE)
    private readonly controlCenterQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('ControlCenterService initialized');
    await this.bootstrapDefaults();
    await this.loadCache();
  }

  private async loadCache() {
    const allDocs = await this.controlCenterModel.find().exec();
    for (const doc of allDocs) {
      if (doc.domain) {
        this.cache.set(doc.domain, doc);
      }
    }
    this.logger.log(
      `ControlCenter Cache loaded with ${allDocs.length} domains`,
    );
  }

  private async bootstrapDefaults() {
    await this.syncDomainFromEnv('payments', 'PAYMENT_PROVIDERS');

    await this.syncNotificationsDefaults();
  }

  private async syncNotificationsDefaults() {
    const channelsEnv = this.configService.get<string>('NOTIFICATION_CHANNELS');
    if (!channelsEnv) return;

    const channels = channelsEnv.split(',').map((c) => c.trim().toLowerCase());
    const domain = 'notifications';

    let doc = await this.controlCenterModel.findOne({ domain });
    if (!doc) {
      doc = new this.controlCenterModel({ domain, providerStates: {} });
    }

    const currentState = doc.providerStates || new Map();
    let hasChanges = false;

    for (const channel of channels) {
      const providersKey = `NOTIFICATION_PROVIDERS_${channel.toUpperCase()}`;
      const providersEnv = this.configService.get<string>(providersKey);

      if (providersEnv) {
        const providers = providersEnv
          .split(',')
          .map((p) => p.trim().toLowerCase());
        for (const provider of providers) {
          const key = `${channel}:${provider}`; // e.g., email:sendgrid
          if (!currentState.has(key)) {
            currentState.set(key, {
              enabled: true,
              isDefault: false,
              status: 'active',
              lastCheck: new Date(),
            });
            hasChanges = true;
          }
        }

        // Ensure exactly one default per channel
        let hasDefault = false;
        for (const [k, v] of currentState) {
          if (k.startsWith(`${channel}:`) && v.isDefault) {
            hasDefault = true;
            break;
          }
        }
        if (!hasDefault && providers.length > 0) {
          const firstKey = `${channel}:${providers[0]}`;
          if (currentState.has(firstKey)) {
            const s = currentState.get(firstKey);
            if (s) {
              s.isDefault = true;
              currentState.set(firstKey, s);
              hasChanges = true;
            }
          }
        }
      }
    }

    if (hasChanges || !doc.providerStates) {
      doc.providerStates = currentState;
      await doc.save();
    }
  }

  private async syncDomainFromEnv(domain: string, envKey: string) {
    const rawProviders = this.configService.get<string>(envKey);
    if (!rawProviders) {
      this.logger.debug(
        `No providers found in env for ${domain} (Key: ${envKey})`,
      );
      return;
    }

    const providers = rawProviders
      .split(',')
      .map((p) => p.trim().toLowerCase());
    this.logger.log(
      `Discovered providers for ${domain}: ${providers.join(', ')}`,
    );

    let doc = await this.controlCenterModel.findOne({ domain });
    if (!doc) {
      doc = new this.controlCenterModel({ domain, providerStates: {} });
    }

    const currentState = doc.providerStates || new Map();
    let hasChanges = false;

    for (const provider of providers) {
      if (!currentState.has(provider)) {
        currentState.set(provider, {
          enabled: true,
          isDefault: false,
          status: 'active',
          lastCheck: new Date(),
        });
        hasChanges = true;
      }
    }

    // Ensure at least one default
    if (providers.length > 0) {
      let hasDefault = false;
      for (const [k, v] of currentState) {
        if (v.isDefault) {
          hasDefault = true;
          break;
        }
      }
      if (!hasDefault) {
        const firstKey = providers[0];
        if (currentState.has(firstKey)) {
          const s = currentState.get(firstKey);
          if (s) {
            s.isDefault = true;
            currentState.set(firstKey, s);
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges || !doc.providerStates) {
      doc.providerStates = currentState;
      await doc.save();
    }
  }

  async getDomainConfig(domain: string) {
    if (this.cache.has(domain)) {
      return this.cache.get(domain);
    }
    const doc = await this.controlCenterModel.findOne({ domain }).exec();
    if (doc) {
      this.cache.set(domain, doc);
    }
    return doc;
  }

  async getActiveProvider(
    domain: string,
    scope?: string,
  ): Promise<string | null> {
    const config = await this.getDomainConfig(domain);
    if (!config || !config.providerStates) return null;

    for (const [key, state] of config.providerStates) {
      if (state.enabled && state.isDefault) {
        if (scope) {
          if (key.startsWith(`${scope}:`)) {
            return key.split(':')[1];
          }
        } else {
          return key;
        }
      }
    }
    return null;
  }

  async toggleProvider(domain: string, providerKey: string, enabled: boolean) {
    let doc = await this.getDomainConfig(domain);
    if (!doc) throw new Error(`Domain ${domain} not found`);

    if (!doc.providerStates) doc.providerStates = new Map();
    const state = doc.providerStates.get(providerKey);

    if (!state)
      throw new Error(`Provider ${providerKey} not found in ${domain}`);

    state.enabled = enabled;
    doc.providerStates.set(providerKey, state);

    this.cache.set(domain, doc);

    await this.controlCenterQueue.add('update_state', {
      domain,
      providerKey,
      state,
    });

    return doc; // Return updated state immediately
  }

  async setDefaultProvider(domain: string, providerKey: string) {
    let doc = await this.getDomainConfig(domain);
    if (!doc) throw new Error(`Domain ${domain} not found`);

    if (!doc.providerStates || !doc.providerStates.has(providerKey))
      throw new Error(`Provider ${providerKey} not found`);

    const parts = providerKey.split(':');
    const scopePrefix = parts.length > 1 ? `${parts[0]}:` : '';

    for (const [key, val] of doc.providerStates) {
      if (scopePrefix) {
        if (key.startsWith(scopePrefix) && val.isDefault) {
          val.isDefault = false;
          doc.providerStates.set(key, val);
        }
      } else {
        if (val.isDefault) {
          val.isDefault = false;
          doc.providerStates.set(key, val);
        }
      }
    }

    const state = doc.providerStates.get(providerKey)!;
    state.isDefault = true;
    doc.providerStates.set(providerKey, state);

    this.cache.set(domain, doc);

    await this.controlCenterQueue.add('update_state', {
      domain,
      providerKey,
      state,
    });

    return doc;
  }
}
