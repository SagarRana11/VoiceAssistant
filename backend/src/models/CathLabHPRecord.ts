import mongoose, { Schema, Document } from 'mongoose';

export interface ICathLabFlag {
  type: string;
  message: string;
  module: number;
  raisedAt: Date;
}

export interface ICathLabHPRecord extends Document {
  sessionId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;

  // Module 2 — Chief Complaint & Chest Pain
  chiefComplaint: string;
  painCharacter: string;
  painLocation: string;
  painRadiation: string;
  painSeverity: string;
  onset: string;
  durationPerEpisode: string;
  exertionalVsRest: string;
  exertionalQuantified: string;
  relievingFactors: string;
  aggravatingFactors: string;
  dyspnea: string;
  orthopnea: string;
  pnd: string;
  edema: string;
  palpitations: string;
  presyncope: string;
  syncope: string;
  fatigue: string;

  // Module 3 — Risk Factors
  htn: string;
  hyperlipidemia: string;
  diabetes: string;
  knownCAD: string;
  priorMI: string;
  priorPCI_CABG: string;
  heartFailure: string;
  priorCath: string;
  cva_tia: string;
  ckd: string;
  pad: string;
  thyroidDisease: string;
  bleedingHistory: string;
  tobacco: string;
  diet: string;
  exercise: string;
  alcohol: string;
  recreationalDrugUse: string;
  familyHistory: string;
  ros_constitutional: string;
  ros_neuro: string;
  ros_pulmonary: string;
  ros_gi: string;
  ros_gu: string;
  ros_msk: string;
  ros_heme: string;
  ros_endocrine: string;
  additionalConcerns: string;

  // Module 4 — Medications & Allergies
  medications: string;
  anticoagulants: string;
  pde5Inhibitors: string;
  allergies: string;
  contrastAllergy: string;

  // Module 5 — Non-Invasive Testing
  echoResults: string;
  stressTestResults: string;
  cctaResults: string;
  labConcerns: string;

  // Module 6 — Consent
  patientConcerns: string;
  verbalConsent: string;

  // Clinical flags
  flags: ICathLabFlag[];

  createdAt: Date;
  updatedAt: Date;
}

const flagSchema = new Schema<ICathLabFlag>(
  {
    type:     { type: String, required: true },
    message:  { type: String, required: true },
    module:   { type: Number, required: true },
    raisedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new Schema<ICathLabHPRecord>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'CathLabSession', required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'CathLabPatient', required: true },

    chiefComplaint:      { type: String, default: '' },
    painCharacter:       { type: String, default: '' },
    painLocation:        { type: String, default: '' },
    painRadiation:       { type: String, default: '' },
    painSeverity:        { type: String, default: '' },
    onset:               { type: String, default: '' },
    durationPerEpisode:  { type: String, default: '' },
    exertionalVsRest:    { type: String, default: '' },
    exertionalQuantified:{ type: String, default: '' },
    relievingFactors:    { type: String, default: '' },
    aggravatingFactors:  { type: String, default: '' },
    dyspnea:             { type: String, default: '' },
    orthopnea:           { type: String, default: '' },
    pnd:                 { type: String, default: '' },
    edema:               { type: String, default: '' },
    palpitations:        { type: String, default: '' },
    presyncope:          { type: String, default: '' },
    syncope:             { type: String, default: '' },
    fatigue:             { type: String, default: '' },

    htn:               { type: String, default: '' },
    hyperlipidemia:    { type: String, default: '' },
    diabetes:          { type: String, default: '' },
    knownCAD:          { type: String, default: '' },
    priorMI:           { type: String, default: '' },
    priorPCI_CABG:     { type: String, default: '' },
    heartFailure:      { type: String, default: '' },
    priorCath:         { type: String, default: '' },
    cva_tia:           { type: String, default: '' },
    ckd:               { type: String, default: '' },
    pad:               { type: String, default: '' },
    thyroidDisease:    { type: String, default: '' },
    bleedingHistory:   { type: String, default: '' },
    tobacco:           { type: String, default: '' },
    diet:              { type: String, default: '' },
    exercise:          { type: String, default: '' },
    alcohol:           { type: String, default: '' },
    recreationalDrugUse: { type: String, default: '' },
    familyHistory:     { type: String, default: '' },
    ros_constitutional:{ type: String, default: '' },
    ros_neuro:         { type: String, default: '' },
    ros_pulmonary:     { type: String, default: '' },
    ros_gi:            { type: String, default: '' },
    ros_gu:            { type: String, default: '' },
    ros_msk:           { type: String, default: '' },
    ros_heme:          { type: String, default: '' },
    ros_endocrine:     { type: String, default: '' },
    additionalConcerns:{ type: String, default: '' },

    medications:     { type: String, default: '' },
    anticoagulants:  { type: String, default: '' },
    pde5Inhibitors:  { type: String, default: '' },
    allergies:       { type: String, default: '' },
    contrastAllergy: { type: String, default: '' },

    echoResults:       { type: String, default: '' },
    stressTestResults: { type: String, default: '' },
    cctaResults:       { type: String, default: '' },
    labConcerns:       { type: String, default: '' },

    patientConcerns: { type: String, default: '' },
    verbalConsent:   { type: String, default: '' },

    flags: { type: [flagSchema], default: [] },
  },
  { timestamps: true },
);

export const CathLabHPRecord = mongoose.model<ICathLabHPRecord>('CathLabHPRecord', schema);
