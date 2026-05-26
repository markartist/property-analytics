import type { EvsExecutionPlan, EvsProfileDefinition, EvsProviderAdapter } from "../../../../packages/shared/src/evs-types";
import type { EvsPropertyRecord, EvsValidationRequest } from "../../../../packages/shared/src/evs-schemas";

const browserStackProvider: EvsProviderAdapter = {
  id: "browserstack",
  label: "BrowserStack Automate",
  buildExecutionPlan(
    request: EvsValidationRequest,
    property: EvsPropertyRecord,
    profiles: EvsProfileDefinition[]
  ): EvsExecutionPlan {
    return {
      request,
      property,
      profiles,
      workflow_name: "evs-browserstack-experiential.yml",
      workflow_inputs: {
        request_id: request.request_id,
        property_id: property.property_id,
        property_name: property.property_name,
        target_url: property.staging_url,
        environment: request.environment,
        source_consumer: request.source_consumer,
        validation_profiles: request.validation_profiles.join(","),
        device_profiles: request.device_profiles.join(","),
        execution_mode: request.execution_mode,
      },
    };
  },
};

export function resolveProviderAdapter(): EvsProviderAdapter {
  return browserStackProvider;
}
