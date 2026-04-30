// ─── Cath Lab H&P Script Config ───────────────────────────────────────────────
// All dialogue, capture fields, branch conditions, and clinical flags
// sourced from: "Cath Lab H&P Avatar.pdf" — Mount Sinai NP Admitting H&P

export interface BranchCondition {
  if: string; // keyword/condition hint for LLM
  then: 'FOLLOWUP' | 'FLAG' | 'EDUCATIONAL';
  question?: string; // for FOLLOWUP
  flag?: string; // for FLAG
  message?: string; // flag message shown to user
  education?: string; // for EDUCATIONAL
}

export interface HPStep {
  module: number;
  moduleLabel: string;
  step: string;
  stepLabel: string;
  avatarText: string; // exact dialogue from PDF
  captureFields: string[]; // fields to extract from patient response
  branchConditions: BranchCondition[];
  isEducation?: boolean; // module 6 educational steps — avatar speaks, patient listens/asks
}

// ─── All steps ordered sequentially ──────────────────────────────────────────
export const HP_STEPS: HPStep[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 1 — Introduction & Rapport
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 1,
    moduleLabel: 'Introduction',
    step: 'greeting',
    stepLabel: 'Welcome',
    avatarText:
      "Hello, and welcome to the Mount Sinai Cardiac Catheterization Laboratory. My name is Sofiya, and I'm a virtual member of your care team. Before your procedure today, I'm going to ask you a series of questions so we can get a complete picture of your health, how you've been feeling, and make sure everything is tailored specifically to you. There are no wrong answers. Please be as honest and detailed as you can — everything you share helps us take the best possible care of you. This should take about 15 to 20 minutes. Are you ready to get started?",
    captureFields: [],
    branchConditions: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 2 — Chief Complaint & Chest Pain History
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'chief_complaint',
    stepLabel: 'Chief Complaint',
    avatarText:
      "Wonderful. Let's begin. First, I'd like to talk about what's been bringing you in and the chest pain you've been experiencing. Can you tell me, in your own words, what's been going on?",
    captureFields: ['chiefComplaint'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_character',
    stepLabel: 'Pain Character',
    avatarText:
      "Thank you for sharing that. I want to make sure I understand exactly what this feels like. How would you describe the sensation? For example — is it more of a pressure, a squeezing, a burning, a sharp stabbing, or something else entirely?",
    captureFields: ['painCharacter'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_location',
    stepLabel: 'Location',
    avatarText:
      "Where exactly do you feel it? Can you point to it or describe the location — for example, the center of your chest, the left side, or somewhere else?",
    captureFields: ['painLocation'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_radiation',
    stepLabel: 'Radiation',
    avatarText:
      "Does the discomfort stay in one place, or does it travel anywhere — like your left arm, your jaw, your neck, your back, or your shoulder?",
    captureFields: ['painRadiation'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_severity',
    stepLabel: 'Severity',
    avatarText:
      "On a scale of zero to ten — zero being no discomfort at all and ten being the worst pain you've ever felt in your life — how would you rate it at its worst?",
    captureFields: ['painSeverity'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_onset',
    stepLabel: 'Onset',
    avatarText:
      "When did you first start noticing this? And has it been happening more than once, or was it a single episode?",
    captureFields: ['onset'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_duration',
    stepLabel: 'Duration',
    avatarText:
      "How long does each episode typically last — seconds, minutes, or hours?",
    captureFields: ['durationPerEpisode'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'pain_timing',
    stepLabel: 'Timing & Pattern',
    avatarText:
      "Does it come on at a predictable time — for example, during physical activity like climbing stairs or walking? Or does it happen at rest, even while you're sitting still or sleeping?",
    captureFields: ['exertionalVsRest'],
    branchConditions: [
      {
        if: 'exertional',
        then: 'FOLLOWUP',
        question:
          "How many blocks can you walk before having chest pain? How many flights of stairs can you climb before you have chest pain?",
      },
      {
        if: 'rest',
        then: 'FLAG',
        flag: 'possible_acs',
        message: 'Possible unstable angina or ACS — confirm with clinical team',
      },
    ],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'relieving_factors',
    stepLabel: 'Relieving Factors',
    avatarText:
      "What makes it better? For example — does it improve with rest, with nitroglycerin if you've been given it, with antacids, or with changing your position?",
    captureFields: ['relievingFactors'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'aggravating_factors',
    stepLabel: 'Aggravating Factors',
    avatarText:
      "And what makes it worse? Does physical exertion, stress, eating, or lying flat bring it on?",
    captureFields: ['aggravatingFactors'],
    branchConditions: [],
  },
  {
    module: 2,
    moduleLabel: 'Chief Complaint',
    step: 'associated_symptoms',
    stepLabel: 'Associated Symptoms',
    avatarText:
      "Along with the chest discomfort, have you noticed any of the following? I'll go through them one by one — just let me know yes or no, and feel free to add any details. Shortness of breath? Shortness of breath when lying flat — do you need extra pillows to sleep comfortably? Have you woken up at night suddenly short of breath? Swelling in your legs or ankles? Palpitations — a fluttering, racing, or irregular heartbeat? Lightheadedness or dizziness? Have you actually fainted or lost consciousness? Unusual fatigue or decreased exercise tolerance — finding activities harder than they used to be?",
    captureFields: ['dyspnea', 'orthopnea', 'pnd', 'edema', 'palpitations', 'presyncope', 'syncope', 'fatigue'],
    branchConditions: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 3 — Cardiac Risk Factor Assessment
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 3,
    moduleLabel: 'Risk Factors',
    step: 'diagnoses',
    stepLabel: 'Medical History',
    avatarText:
      "Thank you. That was a complete picture of your symptoms. Now I'd like to ask about your medical history and some risk factors for heart disease. These help us understand the full context of what you're experiencing. Have you ever been told you have high blood pressure, also called hypertension? High cholesterol or abnormal lipids? Diabetes — either Type 1 or Type 2? Has a doctor ever told you that you have coronary artery disease, or that you've had a blockage in a heart artery? Have you ever had a heart attack — sometimes called a myocardial infarction? Have you had any prior heart procedures — like a stent placed, a balloon procedure called angioplasty, or open heart bypass surgery? Any history of heart failure? Have you had any prior cardiac catheterizations? Any history of stroke or TIA — sometimes called a mini-stroke? Kidney disease or chronic kidney problems? Peripheral artery disease — blockages in the arteries of your legs? Any thyroid conditions? Any bleeding disorders or history of significant bleeding?",
    captureFields: [
      'htn', 'hyperlipidemia', 'diabetes', 'knownCAD', 'priorMI',
      'priorPCI_CABG', 'heartFailure', 'priorCath', 'cva_tia',
      'ckd', 'pad', 'thyroidDisease', 'bleedingHistory',
    ],
    branchConditions: [],
  },
  {
    module: 3,
    moduleLabel: 'Risk Factors',
    step: 'lifestyle',
    stepLabel: 'Lifestyle',
    avatarText:
      "Do you smoke cigarettes or use tobacco products? If so, how much and for how long? If you've quit, when did you stop? How would you describe your diet — do you eat a lot of salty, fatty, or processed foods? How physically active are you on a typical week? Do you drink alcohol? If so, how many drinks per week on average? Do you use any recreational drugs — including cocaine, methamphetamine, or marijuana? There's no judgment here — these substances can directly affect heart arteries and rhythm, so it's important for your safety.",
    captureFields: ['tobacco', 'diet', 'exercise', 'alcohol', 'recreationalDrugUse'],
    branchConditions: [
      {
        if: 'cocaine or methamphetamine or stimulant',
        then: 'FLAG',
        flag: 'coronary_vasospasm',
        message: 'Coronary vasospasm risk — notify procedural team',
      },
    ],
  },
  {
    module: 3,
    moduleLabel: 'Risk Factors',
    step: 'family_hx',
    stepLabel: 'Family History',
    avatarText:
      "Has anyone in your immediate family — parents, siblings, or children — had heart disease, a heart attack, or a sudden cardiac death, especially before age 55 in men or age 65 in women?",
    captureFields: ['familyHistory'],
    branchConditions: [],
  },
  {
    module: 3,
    moduleLabel: 'Risk Factors',
    step: 'ros',
    stepLabel: 'Review of Systems',
    avatarText:
      "I'd like to do a quick review of how the rest of your body has been feeling — not just your heart. I'll go through these fairly quickly — just yes or no is fine, and add any detail you think is important. Have you been feeling unusually tired or fatigued? Any unexplained fevers, chills, or night sweats? Any unintentional weight loss or weight gain? Any severe or unusual headaches? Any weakness, numbness, or tingling in your arms or legs? Any difficulty with speech or vision changes? Any chronic cough, wheezing, or history of asthma or COPD? Have you ever been told you have sleep apnea? Any nausea, vomiting, or abdominal pain? Any black, tarry, or bloody stools, or vomiting of blood? Any history of peptic ulcer disease? Any changes in urination? Any significant joint problems, arthritis, or difficulty with positioning? Have you had any surgeries or procedures in the past 30 days? Any blood disorders — such as anemia, clotting disorders, or low platelet counts? Any active cancer or chemotherapy? Any hormonal conditions — such as thyroid problems, adrenal issues, or gout? Is there any possibility you could be pregnant? Is there anything else going on health-wise that you feel I should know about?",
    captureFields: [
      'ros_constitutional', 'ros_neuro', 'ros_pulmonary', 'ros_gi',
      'ros_gu', 'ros_msk', 'ros_heme', 'ros_endocrine', 'additionalConcerns',
    ],
    branchConditions: [
      {
        if: 'GI bleeding or bloody stools or vomiting blood',
        then: 'FLAG',
        flag: 'gi_bleeding',
        message: 'GI bleeding — anticoagulation consideration, confirm with physician',
      },
      {
        if: 'surgery within past 30 days or recent surgery',
        then: 'FLAG',
        flag: 'recent_surgery',
        message: 'Recent surgery — discuss anticoagulation risk/benefit with physician',
      },
      {
        if: 'focal neurological symptoms or transient speech or vision changes',
        then: 'FOLLOWUP',
        question: 'When did this happen? Do you have any lingering symptoms from this?',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 4 — Medications & Allergies
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 4,
    moduleLabel: 'Medications',
    step: 'medications',
    stepLabel: 'Medications',
    avatarText:
      "Let's go over your medications. Can you tell me everything you're currently taking — including prescription medications, over-the-counter drugs, vitamins, supplements, and herbal products? Are you taking any blood thinners — for example, aspirin, clopidogrel (Plavix), ticagrelor (Brilinta), warfarin (Coumadin), apixaban (Eliquis), rivaroxaban (Xarelto), or dabigatran (Pradaxa)? Are you taking Viagra, Cialis, Levitra, or any other erectile dysfunction or pulmonary hypertension medications?",
    captureFields: ['medications', 'anticoagulants', 'pde5Inhibitors'],
    branchConditions: [
      {
        if: 'Viagra or Cialis or Levitra or sildenafil or tadalafil or vardenafil or PDE5',
        then: 'FLAG',
        flag: 'pde5_nitroglycerin',
        message: 'Nitroglycerin contraindication — patient takes PDE5 inhibitor, notify team',
      },
    ],
  },
  {
    module: 4,
    moduleLabel: 'Medications',
    step: 'allergies',
    stepLabel: 'Allergies',
    avatarText:
      "Do you have any known allergies — to medications, foods, latex, or anything else? And if you've had a reaction, can you describe what happened? Very importantly — have you ever had a reaction to contrast dye or iodine? This is the dye used in CT scans, X-ray dye studies, or prior cardiac catheterizations — sometimes people describe feeling flushed, developing hives, or having trouble breathing.",
    captureFields: ['allergies', 'contrastAllergy'],
    branchConditions: [
      {
        if: 'contrast dye reaction or iodine reaction or allergy to contrast',
        then: 'FLAG',
        flag: 'contrast_allergy',
        message: 'Contrast allergy — confirm premedication protocol (prednisone + diphenhydramine) with team',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 5 — Review of Non-Invasive Testing
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 5,
    moduleLabel: 'Prior Testing',
    step: 'echo',
    stepLabel: 'Echocardiogram',
    avatarText:
      "Before your catheterization today, I imagine you may have had some other heart tests done. I'd like to review those with you. Have you had a cardiac ultrasound — called an echocardiogram or 'echo'? It uses sound waves to take pictures of the heart's structure and pumping function. If so, were you told anything about the results — for example, your ejection fraction or pumping function, any abnormal wall motion, or any valve problems?",
    captureFields: ['echoResults'],
    branchConditions: [
      {
        if: 'reduced ejection fraction or low EF or reduced EF',
        then: 'EDUCATIONAL',
        education:
          "Your echo showed that the heart's pumping function is somewhat reduced — what we call a lower ejection fraction. The catheterization will help us understand whether blocked arteries are contributing to that, and whether opening them might help the heart pump better.",
      },
      {
        if: 'wall motion abnormality or wall not moving',
        then: 'EDUCATIONAL',
        education:
          "The echo showed that part of the heart wall isn't moving as well as the others. This can mean there's a territory of heart muscle that isn't getting enough blood. The catheterization will help us map exactly which artery supplies that region.",
      },
      {
        if: 'normal echo or normal results',
        then: 'EDUCATIONAL',
        education:
          "Your echo showed good overall pumping function, which is reassuring. However, a normal echo at rest doesn't always mean the arteries are clear — coronary artery disease can exist even with a normal echo.",
      },
    ],
  },
  {
    module: 5,
    moduleLabel: 'Prior Testing',
    step: 'stress_test',
    stepLabel: 'Stress Test',
    avatarText:
      "Did you undergo any type of stress test — sometimes called a treadmill test, a nuclear stress test, or a stress echo? These tests look at how your heart behaves under physical or chemical stress. If so, what type was it, and what were the results?",
    captureFields: ['stressTestResults'],
    branchConditions: [
      {
        if: 'positive nuclear stress test or abnormal nuclear',
        then: 'EDUCATIONAL',
        education:
          "Your nuclear stress test showed a region where blood flow to the heart appears reduced under stress.",
      },
      {
        if: 'positive stress echo or abnormal stress echo or wall motion on stress',
        then: 'EDUCATIONAL',
        education:
          "Your stress echo showed that a segment of the heart wall stopped moving properly under stress — that's called a wall motion abnormality — which suggests that area isn't getting adequate blood flow.",
      },
      {
        if: 'equivocal or inconclusive or borderline stress test',
        then: 'EDUCATIONAL',
        education:
          "Your stress test result was not entirely clear one way or the other. In that case, the catheterization is often the next step because it gives us the most definitive answer about what's actually inside the arteries.",
      },
    ],
  },
  {
    module: 5,
    moduleLabel: 'Prior Testing',
    step: 'ccta_labs',
    stepLabel: 'CT & Labs',
    avatarText:
      "Have you had a CT scan of the heart arteries — called a coronary CTA or coronary calcium score? We've also reviewed your recent blood work. A few things are particularly relevant going into this procedure — your kidney function, your blood count, and your clotting labs. The team has these on file. Is there anything about your lab results that you were told to be aware of?",
    captureFields: ['cctaResults', 'labConcerns'],
    branchConditions: [
      {
        if: 'high calcium score or calcium deposits or stenosis on CT',
        then: 'EDUCATIONAL',
        education:
          "Your CT scan showed calcium deposits or narrowing in the heart arteries. The catheterization gives us a much higher-resolution look and also allows us to treat a blockage during the same procedure if appropriate.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 6 — Education & Informed Consent
  // ═══════════════════════════════════════════════════════════════════════════
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'what_is_cath',
    stepLabel: 'What is a Cath?',
    isEducation: true,
    avatarText:
      "You've been very thorough and patient with all of these questions. Now I'd like to shift gears and spend some time explaining the procedure itself — the cardiac catheterization. A cardiac catheterization — also called a coronary angiogram or 'cath' — is a procedure that allows our doctors to look directly inside the arteries of your heart using a special X-ray system and contrast dye. Think of your coronary arteries as the plumbing of the heart. They are small tubes — typically about the width of a drinking straw — that deliver oxygen-rich blood to the heart muscle itself. When one of those tubes gets narrowed or blocked — most commonly by a buildup of cholesterol and calcium we call plaque — the heart muscle downstream doesn't get enough blood, especially during exertion. That's what causes the symptoms you described. Does that make sense so far?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'procedure_details',
    stepLabel: 'Procedure Steps',
    isEducation: true,
    avatarText:
      "Let me walk you through exactly what will happen, step by step. The procedure begins by placing a small plastic tube into one of your arteries — either in the groin or the wrist. Your doctor will decide immediately before the procedure. Before placing the tube, we inject a small amount of local anesthetic — similar to what a dentist uses. You'll feel a brief sting, and after that the area should be numb. You'll feel pressure and movement during the procedure, but not pain. Through the tube, your doctor guides a thin, flexible tube called a catheter. The catheter travels through your arterial system guided by real-time X-ray imaging. You will not feel the catheter moving inside you. Once the catheter is positioned at the opening of a coronary artery, a small amount of contrast dye is injected. You may feel a brief warm or flushing sensation when the dye is injected — this is completely normal and passes within seconds. The entire procedure is guided by a sophisticated X-ray system called a fluoroscope. The diagnostic catheterization itself typically takes between 30 and 60 minutes. If a blockage is found that can be treated during the same session, that can add another 30 to 40 minutes. Do you have any questions about how the procedure is performed?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'findings_correlation',
    stepLabel: 'Findings & Stenosis',
    isEducation: true,
    avatarText:
      "Here is where all the pieces come together. The symptoms you described to me, the non-invasive tests, and the catheterization all work together. The catheterization is the definitive test — it shows us the anatomy directly. If we find any blockages, we will see how significant they are. Blockages under 50 percent are typically not causing reduced blood flow and are usually managed with medication. Blockages between 50 and 70 percent may or may not be significant — we sometimes use additional tests during the catheterization to determine if they are truly limiting blood flow. Blockages of 70 percent or greater are typically considered significant and need to be treated. Does that make sense?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'treatment_options',
    stepLabel: 'Treatment Options',
    isEducation: true,
    avatarText:
      "If your physician finds a significant blockage, there are several options. Option one is medical management — some blockages are best treated with medications. This typically includes aspirin, a cholesterol-lowering statin, blood pressure medications, and medications to reduce the heart's workload. Option two is a stent procedure — also called PCI or percutaneous coronary intervention. This involves inflating a small balloon inside the artery to compress the plaque, followed by placement of a small metal mesh tube called a stent to hold the artery open. Modern stents are coated with medication to help prevent re-narrowing. PCI is minimally invasive — no open surgery, no general anesthesia, and most patients are discharged within 24 hours. Option three is coronary artery bypass surgery — called CABG — which is open heart surgery sometimes needed when multiple arteries are involved or the anatomy is not suited for stenting. Do you have any questions about the treatment options?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'risks',
    stepLabel: 'Risks',
    isEducation: true,
    avatarText:
      "I want to be completely transparent with you about the risks of this procedure. Common minor risks include bruising or a collection of blood at the access site at the wrist or groin, temporary discomfort, and a warm flushing sensation from the contrast dye — which is normal and brief. Less common risks include bleeding at the access site, contrast-induced kidney stress — especially in patients with pre-existing kidney disease — allergic reaction to the contrast dye, injury to the artery at the access site, and temporary abnormal heart rhythms. Serious but rare risks include heart attack, stroke, and — in elective, stable patients — the risk of death is approximately 1 in 1,000 or less. The procedure also uses X-ray radiation, but the risk from a single catheterization is considered very low and is well justified by the clinical benefit. Our team performs hundreds of these procedures and is highly trained to manage any complications. Do you have any questions about the risks?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'benefits_alternatives',
    stepLabel: 'Benefits & Alternatives',
    isEducation: true,
    avatarText:
      "The benefits of having this procedure are substantial. The catheterization provides a definitive diagnosis — no other test gives us a more accurate picture of your coronary arteries. If a significant blockage is found and treated, many patients experience significant improvement or complete resolution of their chest pain and shortness of breath. Even if no intervention is performed, knowing the exact anatomy allows your physician to choose the most appropriate medications. As for alternatives — you could pursue additional non-invasive testing, choose empiric medical therapy without catheterization, or decline any testing or treatment entirely. Your physician has recommended the catheterization because they believe the benefit for you specifically outweighs the risks — but we want you to be an active participant in this decision. Do you have any questions about the benefits or alternatives?",
    captureFields: [],
    branchConditions: [],
  },
  {
    module: 6,
    moduleLabel: 'Education & Consent',
    step: 'closing_consent',
    stepLabel: 'Consent',
    avatarText:
      "That was a lot of information, and I want to make sure you had a chance to take it in. Do you have any questions about the procedure, the risks, or anything we discussed today? Is there anything that is worrying you specifically that we haven't addressed? Based on everything we've discussed today, do you feel that you understand the procedure and consent to moving forward?",
    captureFields: ['patientConcerns', 'verbalConsent'],
    branchConditions: [
      {
        if: 'no or wants more time or not sure or need to think',
        then: 'FLAG',
        flag: 'consent_deferred',
        message: 'Patient requests physician discussion prior to consent',
      },
      {
        if: 'declines or refuse or do not want or no procedure',
        then: 'FLAG',
        flag: 'patient_declining',
        message: 'Patient declining procedure — notify physician immediately',
      },
    ],
  },
];

// ─── Step lookup helpers ───────────────────────────────────────────────────────

export function getStepConfig(stepId: string): HPStep | undefined {
  return HP_STEPS.find(s => s.step === stepId);
}

export function getNextStep(currentStepId: string): HPStep | undefined {
  const idx = HP_STEPS.findIndex(s => s.step === currentStepId);
  if (idx === -1 || idx >= HP_STEPS.length - 1) return undefined;
  return HP_STEPS[idx + 1];
}

export function getAllSteps(): HPStep[] {
  return HP_STEPS;
}

// ─── Flag message lookup ───────────────────────────────────────────────────────
export const FLAG_MESSAGES: Record<string, string> = {
  possible_acs:       'Possible unstable angina or ACS — confirm with clinical team',
  coronary_vasospasm: 'Coronary vasospasm risk — notify procedural team',
  pde5_nitroglycerin: 'Nitroglycerin contraindication — patient takes PDE5 inhibitor',
  contrast_allergy:   'Contrast allergy — premedication protocol required (prednisone + diphenhydramine)',
  gi_bleeding:        'GI bleeding history — anticoagulation consideration',
  recent_surgery:     'Recent surgery (past 30 days) — discuss anticoagulation risk/benefit with physician',
  consent_deferred:   'Patient requests physician discussion prior to consent',
  patient_declining:  'Patient declining procedure — notify physician immediately',
};
