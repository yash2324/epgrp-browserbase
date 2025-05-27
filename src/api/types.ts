// Types for API request/response
export interface FormDataPayload {
  Description: string;
  "Bag type": string;
  "Face Width mm": string;
  "Gusset mm": string;
  "Bag Length mm": string;
  "Bottom glue": string;
  "Packed in": string;
  "Pack Size": string;
  "No of boxes ordered": string;
  "Bags per box": string;
  "Machines per supervisor": string;
}

export interface CostOverridePayload {
  field: string;
  value: string | number;
}

export interface CostingRequestPayload {
  formData: FormDataPayload;
  costOverrides: CostOverridePayload[];
  sender_email: string;
  specSheetId: string;
}

export interface MultipleCostingRequestPayload {
  specSheetId: string;
  emailId: string;
  formData: FormDataPayload;
  costOverrides: CostOverridePayload[];
  sender_email: string;
  spec_sheet_id: string;
  trackingId: string;
  rowIndex: number;
}

export interface MultipleCostingRequest {
  payloads: MultipleCostingRequestPayload[];
}
