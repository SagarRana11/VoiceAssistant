// Frontend step metadata — mirrors cathLabScript.ts on the backend.
// Used to display module/step labels and speak the initial step on page load.

export const MODULE_LABELS: Record<number, string> = {
  1: 'Introduction',
  2: 'Chief Complaint',
  3: 'Risk Factors',
  4: 'Medications',
  5: 'Prior Testing',
  6: 'Education & Consent',
};

export interface StepMeta {
  module: number;
  moduleLabel: string;
  stepLabel: string;
  avatarText: string;
}

export const STEP_META: Record<string, StepMeta> = {
  greeting: {
    module: 1,
    moduleLabel: 'Introduction',
    stepLabel: 'Welcome',
    avatarText:
      "Hello, and welcome to the Mount Sinai Cardiac Catheterization Laboratory. My name is Sofiya, and I'm a virtual member of your care team. Before your procedure today, I'm going to ask you a series of questions so we can get a complete picture of your health, how you've been feeling, and make sure everything is tailored specifically to you. There are no wrong answers. Please be as honest and detailed as you can — everything you share helps us take the best possible care of you. This should take about 15 to 20 minutes. Are you ready to get started?",
  },
  chief_complaint: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Chief Complaint',
    avatarText:
      "Wonderful. Let's begin. First, I'd like to talk about what's been bringing you in and the chest pain you've been experiencing. Can you tell me, in your own words, what's been going on?",
  },
  pain_character: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Pain Character',
    avatarText:
      "Thank you for sharing that. I want to make sure I understand exactly what this feels like. How would you describe the sensation? For example — is it more of a pressure, a squeezing, a burning, a sharp stabbing, or something else entirely?",
  },
  pain_location: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Location',
    avatarText:
      "Where exactly do you feel it? Can you point to it or describe the location — for example, the center of your chest, the left side, or somewhere else?",
  },
  pain_radiation: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Radiation',
    avatarText:
      "Does the discomfort stay in one place, or does it travel anywhere — like your left arm, your jaw, your neck, your back, or your shoulder?",
  },
  pain_severity: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Severity',
    avatarText:
      "On a scale of zero to ten — zero being no discomfort at all and ten being the worst pain you've ever felt in your life — how would you rate it at its worst?",
  },
  pain_onset: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Onset',
    avatarText:
      "When did you first start noticing this? And has it been happening more than once, or was it a single episode?",
  },
  pain_duration: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Duration',
    avatarText:
      "How long does each episode typically last — seconds, minutes, or hours?",
  },
  pain_timing: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Timing & Pattern',
    avatarText:
      "Does it come on at a predictable time — for example, during physical activity like climbing stairs or walking? Or does it happen at rest, even while you're sitting still or sleeping?",
  },
  relieving_factors: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Relieving Factors',
    avatarText:
      "What makes it better? For example — does it improve with rest, with nitroglycerin if you've been given it, with antacids, or with changing your position?",
  },
  aggravating_factors: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Aggravating Factors',
    avatarText:
      "And what makes it worse? Does physical exertion, stress, eating, or lying flat bring it on?",
  },
  associated_symptoms: {
    module: 2,
    moduleLabel: 'Chief Complaint',
    stepLabel: 'Associated Symptoms',
    avatarText:
      "Along with the chest discomfort, have you noticed any of the following? I'll go through them one by one — just let me know yes or no, and feel free to add any details. Shortness of breath? Shortness of breath when lying flat — do you need extra pillows to sleep comfortably? Have you woken up at night suddenly short of breath? Swelling in your legs or ankles? Palpitations — a fluttering, racing, or irregular heartbeat? Lightheadedness or dizziness? Have you actually fainted or lost consciousness? Unusual fatigue or decreased exercise tolerance — finding activities harder than they used to be?",
  },
  diagnoses: {
    module: 3,
    moduleLabel: 'Risk Factors',
    stepLabel: 'Medical History',
    avatarText:
      "Thank you. That was a complete picture of your symptoms. Now I'd like to ask about your medical history and some risk factors for heart disease. These help us understand the full context of what you're experiencing. Have you ever been told you have high blood pressure, also called hypertension? High cholesterol or abnormal lipids? Diabetes — either Type 1 or Type 2? Has a doctor ever told you that you have coronary artery disease, or that you've had a blockage in a heart artery? Have you ever had a heart attack — sometimes called a myocardial infarction? Have you had any prior heart procedures — like a stent placed, a balloon procedure called angioplasty, or open heart bypass surgery? Any history of heart failure? Have you had any prior cardiac catheterizations? Any history of stroke or TIA — sometimes called a mini-stroke? Kidney disease or chronic kidney problems? Peripheral artery disease — blockages in the arteries of your legs? Any thyroid conditions? Any bleeding disorders or history of significant bleeding?",
  },
  lifestyle: {
    module: 3,
    moduleLabel: 'Risk Factors',
    stepLabel: 'Lifestyle',
    avatarText:
      "Do you smoke cigarettes or use tobacco products? If so, how much and for how long? If you've quit, when did you stop? How would you describe your diet — do you eat a lot of salty, fatty, or processed foods? How physically active are you on a typical week? Do you drink alcohol? If so, how many drinks per week on average? Do you use any recreational drugs — including cocaine, methamphetamine, or marijuana? There's no judgment here — these substances can directly affect heart arteries and rhythm, so it's important for your safety.",
  },
  family_hx: {
    module: 3,
    moduleLabel: 'Risk Factors',
    stepLabel: 'Family History',
    avatarText:
      "Has anyone in your immediate family — parents, siblings, or children — had heart disease, a heart attack, or a sudden cardiac death, especially before age 55 in men or age 65 in women?",
  },
  ros: {
    module: 3,
    moduleLabel: 'Risk Factors',
    stepLabel: 'Review of Systems',
    avatarText:
      "I'd like to do a quick review of how the rest of your body has been feeling — not just your heart. I'll go through these fairly quickly — just yes or no is fine, and add any detail you think is important. Have you been feeling unusually tired or fatigued? Any unexplained fevers, chills, or night sweats? Any unintentional weight loss or weight gain? Any severe or unusual headaches? Any weakness, numbness, or tingling in your arms or legs? Any difficulty with speech or vision changes? Any chronic cough, wheezing, or history of asthma or COPD? Have you ever been told you have sleep apnea? Any nausea, vomiting, or abdominal pain? Any black, tarry, or bloody stools, or vomiting of blood? Any history of peptic ulcer disease? Any changes in urination? Any significant joint problems, arthritis, or difficulty with positioning? Have you had any surgeries or procedures in the past 30 days? Any blood disorders — such as anemia, clotting disorders, or low platelet counts? Any active cancer or chemotherapy? Any hormonal conditions — such as thyroid problems, adrenal issues, or gout? Is there any possibility you could be pregnant? Is there anything else going on health-wise that you feel I should know about?",
  },
  medications: {
    module: 4,
    moduleLabel: 'Medications',
    stepLabel: 'Medications',
    avatarText:
      "Let's go over your medications. Can you tell me everything you're currently taking — including prescription medications, over-the-counter drugs, vitamins, supplements, and herbal products? Are you taking any blood thinners — for example, aspirin, clopidogrel (Plavix), ticagrelor (Brilinta), warfarin (Coumadin), apixaban (Eliquis), rivaroxaban (Xarelto), or dabigatran (Pradaxa)? Are you taking Viagra, Cialis, Levitra, or any other erectile dysfunction or pulmonary hypertension medications?",
  },
  allergies: {
    module: 4,
    moduleLabel: 'Medications',
    stepLabel: 'Allergies',
    avatarText:
      "Do you have any known allergies — to medications, foods, latex, or anything else? And if you've had a reaction, can you describe what happened? Very importantly — have you ever had a reaction to contrast dye or iodine? This is the dye used in CT scans, X-ray dye studies, or prior cardiac catheterizations — sometimes people describe feeling flushed, developing hives, or having trouble breathing.",
  },
  echo: {
    module: 5,
    moduleLabel: 'Prior Testing',
    stepLabel: 'Echocardiogram',
    avatarText:
      "Before your catheterization today, I imagine you may have had some other heart tests done. I'd like to review those with you. Have you had a cardiac ultrasound — called an echocardiogram or 'echo'? It uses sound waves to take pictures of the heart's structure and pumping function. If so, were you told anything about the results — for example, your ejection fraction or pumping function, any abnormal wall motion, or any valve problems?",
  },
  stress_test: {
    module: 5,
    moduleLabel: 'Prior Testing',
    stepLabel: 'Stress Test',
    avatarText:
      "Did you undergo any type of stress test — sometimes called a treadmill test, a nuclear stress test, or a stress echo? These tests look at how your heart behaves under physical or chemical stress. If so, what type was it, and what were the results?",
  },
  ccta_labs: {
    module: 5,
    moduleLabel: 'Prior Testing',
    stepLabel: 'CT & Labs',
    avatarText:
      "Have you had a CT scan of the heart arteries — called a coronary CTA or coronary calcium score? We've also reviewed your recent blood work. A few things are particularly relevant going into this procedure — your kidney function, your blood count, and your clotting labs. The team has these on file. Is there anything about your lab results that you were told to be aware of?",
  },
  what_is_cath: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'What is a Cath?',
    avatarText:
      "You've been very thorough and patient with all of these questions. Now I'd like to shift gears and spend some time explaining the procedure itself — the cardiac catheterization. A cardiac catheterization — also called a coronary angiogram or 'cath' — is a procedure that allows our doctors to look directly inside the arteries of your heart using a special X-ray system and contrast dye. Think of your coronary arteries as the plumbing of the heart. They are small tubes — typically about the width of a drinking straw — that deliver oxygen-rich blood to the heart muscle itself. When one of those tubes gets narrowed or blocked — most commonly by a buildup of cholesterol and calcium we call plaque — the heart muscle downstream doesn't get enough blood, especially during exertion. That's what causes the symptoms you described. Does that make sense so far?",
  },
  procedure_details: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Procedure Steps',
    avatarText:
      "Let me walk you through exactly what will happen, step by step. The procedure begins by placing a small plastic tube into one of your arteries — either in the groin or the wrist. Your doctor will decide immediately before the procedure. Before placing the tube, we inject a small amount of local anesthetic — similar to what a dentist uses. You'll feel a brief sting, and after that the area should be numb. You'll feel pressure and movement during the procedure, but not pain. Through the tube, your doctor guides a thin, flexible tube called a catheter. The catheter travels through your arterial system guided by real-time X-ray imaging. You will not feel the catheter moving inside you. Once the catheter is positioned at the opening of a coronary artery, a small amount of contrast dye is injected. You may feel a brief warm or flushing sensation when the dye is injected — this is completely normal and passes within seconds. The entire procedure is guided by a sophisticated X-ray system called a fluoroscope. The diagnostic catheterization itself typically takes between 30 and 60 minutes. If a blockage is found that can be treated during the same session, that can add another 30 to 40 minutes. Do you have any questions about how the procedure is performed?",
  },
  findings_correlation: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Findings & Stenosis',
    avatarText:
      "Here is where all the pieces come together. The symptoms you described to me, the non-invasive tests, and the catheterization all work together. The catheterization is the definitive test — it shows us the anatomy directly. If we find any blockages, we will see how significant they are. Blockages under 50 percent are typically not causing reduced blood flow and are usually managed with medication. Blockages between 50 and 70 percent may or may not be significant — we sometimes use additional tests during the catheterization to determine if they are truly limiting blood flow. Blockages of 70 percent or greater are typically considered significant and need to be treated. Does that make sense?",
  },
  treatment_options: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Treatment Options',
    avatarText:
      "If your physician finds a significant blockage, there are several options. Option one is medical management — some blockages are best treated with medications. This typically includes aspirin, a cholesterol-lowering statin, blood pressure medications, and medications to reduce the heart's workload. Option two is a stent procedure — also called PCI or percutaneous coronary intervention. This involves inflating a small balloon inside the artery to compress the plaque, followed by placement of a small metal mesh tube called a stent to hold the artery open. Modern stents are coated with medication to help prevent re-narrowing. PCI is minimally invasive — no open surgery, no general anesthesia, and most patients are discharged within 24 hours. Option three is coronary artery bypass surgery — called CABG — which is open heart surgery sometimes needed when multiple arteries are involved or the anatomy is not suited for stenting. Do you have any questions about the treatment options?",
  },
  risks: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Risks',
    avatarText:
      "I want to be completely transparent with you about the risks of this procedure. Common minor risks include bruising or a collection of blood at the access site at the wrist or groin, temporary discomfort, and a warm flushing sensation from the contrast dye — which is normal and brief. Less common risks include bleeding at the access site, contrast-induced kidney stress — especially in patients with pre-existing kidney disease — allergic reaction to the contrast dye, injury to the artery at the access site, and temporary abnormal heart rhythms. Serious but rare risks include heart attack, stroke, and — in elective, stable patients — the risk of death is approximately 1 in 1,000 or less. The procedure also uses X-ray radiation, but the risk from a single catheterization is considered very low and is well justified by the clinical benefit. Our team performs hundreds of these procedures and is highly trained to manage any complications. Do you have any questions about the risks?",
  },
  benefits_alternatives: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Benefits & Alternatives',
    avatarText:
      "The benefits of having this procedure are substantial. The catheterization provides a definitive diagnosis — no other test gives us a more accurate picture of your coronary arteries. If a significant blockage is found and treated, many patients experience significant improvement or complete resolution of their chest pain and shortness of breath. Even if no intervention is performed, knowing the exact anatomy allows your physician to choose the most appropriate medications. As for alternatives — you could pursue additional non-invasive testing, choose empiric medical therapy without catheterization, or decline any testing or treatment entirely. Your physician has recommended the catheterization because they believe the benefit for you specifically outweighs the risks — but we want you to be an active participant in this decision. Do you have any questions about the benefits or alternatives?",
  },
  closing_consent: {
    module: 6,
    moduleLabel: 'Education & Consent',
    stepLabel: 'Consent',
    avatarText:
      "That was a lot of information, and I want to make sure you had a chance to take it in. Do you have any questions about the procedure, the risks, or anything we discussed today? Is there anything that is worrying you specifically that we haven't addressed? Based on everything we've discussed today, do you feel that you understand the procedure and consent to moving forward?",
  },
};
