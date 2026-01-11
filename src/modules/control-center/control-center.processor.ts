import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ControlCenter,
  ControlCenterDocument,
} from './schemas/control-center.schema';
import { CONTROL_CENTER_QUEUE } from '@app/common/constants/queues';

@Processor(CONTROL_CENTER_QUEUE)
export class ControlCenterProcessor extends WorkerHost {
  private readonly logger = new Logger(ControlCenterProcessor.name);

  constructor(
    @InjectModel(ControlCenter.name)
    private readonly controlCenterModel: Model<ControlCenterDocument>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Processing job ${job.name}`);

    switch (job.name) {
      case 'update_state':
        return this.handleUpdateState(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleUpdateState(data: {
    domain: string;
    providerKey: string;
    state: any;
  }) {
    const { domain, providerKey, state } = data;
    this.logger.log(
      `Persisting state change for ${domain}:${providerKey} -> Enabled: ${state.enabled}, Default: ${state.isDefault}`,
    );

    const doc = await this.controlCenterModel.findOne({ domain });
    if (!doc) {
      this.logger.error(`Domain ${domain} not found during async update`);
      return;
    }

    if (!doc.providerStates) {
      doc.providerStates = new Map();
    }

    if (state.isDefault) {
      // Ensure others in same scope are unset
      const parts = providerKey.split(':');
      const scopePrefix = parts.length > 1 ? `${parts[0]}:` : '';

      for (const [k, v] of doc.providerStates) {
        if (scopePrefix) {
          if (k.startsWith(scopePrefix) && v.isDefault && k !== providerKey) {
            v.isDefault = false;
            doc.providerStates.set(k, v);
          }
        } else {
          if (v.isDefault && k !== providerKey) {
            v.isDefault = false;
            doc.providerStates.set(k, v);
          }
        }
      }
    }

    doc.providerStates.set(providerKey, state);
    await doc.save();
    this.logger.debug(`Persisted ${domain} changes`);
  }
}
