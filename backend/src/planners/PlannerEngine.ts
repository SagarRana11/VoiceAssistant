export interface PlannerContext {
  userId: string;
  profile: Record<string, unknown>;
}

export type SendChunk  = (text: string) => void;
export type SendAction = (action: string, data: unknown) => void;

/**
 * Abstract base for all planner types.
 * Concrete planners (Exercise, Diet, Meditation) extend this.
 */
export abstract class PlannerEngine {
  protected ctx: PlannerContext;

  constructor(userId: string, profile: Record<string, unknown>) {
    this.ctx = { userId, profile };
  }

  /** Validate / enrich profile data before generation */
  abstract collectData(): Promise<Record<string, unknown>>;

  /** Retrieve relevant knowledge documents via RAG */
  abstract retrieveKnowledge(): Promise<string[]>;

  /** Call LLM to generate the plan using profile + knowledge */
  abstract generatePlan(knowledge: string[]): Promise<unknown>;

  /** Persist the generated plan to the database */
  abstract storePlan(plan: unknown): Promise<string>;

  /**
   * Orchestrate the full generation pipeline.
   * Streams progress via sendChunk and signals completion via sendAction.
   */
  async generate(sendChunk: SendChunk, sendAction: SendAction): Promise<void> {
    sendChunk('Retrieving exercise science knowledge... ');
    const knowledge = await this.retrieveKnowledge();

    sendChunk('Building your personalised plan... ');
    const plan = await this.generatePlan(knowledge);

    const planId = await this.storePlan(plan);
    sendAction('PLAN_GENERATED', { planId, plan });

    const typedPlan = plan as { planSummary?: string };
    sendChunk(typedPlan.planSummary ?? 'Your plan is ready!');
    sendChunk(' I\'ve saved it. Would you like me to walk you through the first day?');
  }
}
