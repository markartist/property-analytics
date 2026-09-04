type ScheduledJob = {
  label: string;
  run: () => Promise<unknown>;
};

export type ScheduledJobResult = {
  label: string;
  ok: boolean;
  error?: string;
};

export async function runIndependentScheduledJobs(jobs: ScheduledJob[]): Promise<ScheduledJobResult[]> {
  return Promise.all(
    jobs.map(async (job) => {
      try {
        await job.run();
        return { label: job.label, ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown scheduled job error";
        console.error(`Scheduled ${job.label} failed:`, error);
        return { label: job.label, ok: false, error: message };
      }
    })
  );
}
