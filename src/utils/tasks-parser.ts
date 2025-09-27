/**
 * Parse TASKS.md to extract project progress dynamically
 */

export interface SprintProgress {
  name: string;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  status: 'completed' | 'in-progress' | 'not-started';
}

export interface TaskProgress {
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  phases: {
    [key: string]: {
      complete: boolean;
      description: string;
    };
  };
  sprint2Phases?: {
    [key: string]: {
      complete: boolean;
      description: string;
    };
  };
  lastUpdated: string | null;
  sprints?: SprintProgress[];
}

export async function parseTasksFile(): Promise<TaskProgress> {
  try {
    // Fetch from public folder (copied during build) - use dynamic basePath
    const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME || 'CRUDkit';
    const baseUrl =
      window.location.hostname === 'localhost' ? '' : `/${projectName}`;

    // Add cache-busting timestamp to ensure fresh data
    const url = `${baseUrl}/TASKS.md?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch TASKS.md');
    }

    const content = await response.text();

    // Also fetch archived Sprint 1 TASKS.md for phase completion markers
    let archivedSprint1Content = '';
    try {
      const archiveUrl = `${baseUrl}/docs/spec-kit/archive/v0.1.0-sprint-1/TASKS.md?t=${Date.now()}`;
      const archiveResponse = await fetch(archiveUrl);
      if (archiveResponse.ok) {
        archivedSprint1Content = await archiveResponse.text();
      }
    } catch (error) {
      console.warn('Could not fetch archived Sprint 1 TASKS.md:', error);
    }

    // Extract last updated
    const lastUpdatedMatch = content.match(/Last Updated: ([^(]+)/);
    const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : null;

    // Parse sprint information
    const sprints: SprintProgress[] = [];

    // For completed sprints (Sprint 1 & 2), use hardcoded values since they're archived
    // Sprint 1 - Completed
    sprints.push({
      name: 'Sprint 1: Core',
      completedTasks: 95,
      totalTasks: 96,
      percentage: 99,
      status: 'completed',
    });

    // Sprint 2 - Completed
    sprints.push({
      name: 'Sprint 2: Fix the Foundation',
      completedTasks: 65,
      totalTasks: 65,
      percentage: 100,
      status: 'completed',
    });

    // Sprint 3 - New format with S3T prefix
    const sprint3HeaderMatch = content.match(/Sprint 3[^:]*:/);
    if (sprint3HeaderMatch) {
      // Count S3T tasks
      const s3tMatches = content.match(/S3T\d{3}/g) || [];
      const totalS3Tasks = s3tMatches.length;

      // Count completed S3T tasks (look for [x] on the third line after task ID)
      let completedS3Tasks = 0;
      for (const taskId of s3tMatches) {
        // Pattern: Task ID on line 1, skip line 2, checkbox [x] on line 3
        const taskPattern = new RegExp(
          `${taskId}[^\\n]*\\n[^\\n]*\\n[^\\n]*\\[x\\]`,
          's'
        );
        if (taskPattern.test(content)) {
          completedS3Tasks++;
        }
      }

      const s3Percentage =
        totalS3Tasks > 0
          ? Math.round((completedS3Tasks / totalS3Tasks) * 100)
          : 0;

      sprints.push({
        name: 'Sprint 3: Complete the Constitutional Vision',
        completedTasks: completedS3Tasks,
        totalTasks: totalS3Tasks,
        percentage: s3Percentage,
        status: completedS3Tasks > 0 ? 'in-progress' : 'not-started',
      });
    }

    // Extract Sprint 1 phase statuses from archived content
    const phases: TaskProgress['phases'] = {};
    const contentToCheck = archivedSprint1Content || content; // Use archived content if available

    // Sprint 1 Phase 0
    if (contentToCheck.includes('✅ **Phase 0 Complete**')) {
      phases['Phase 0'] = {
        complete: true,
        description: 'Next.js app deployed to GitHub Pages',
      };
    }

    // Sprint 1 Phase 1
    if (contentToCheck.includes('✅ **Phase 1 Complete**')) {
      phases['Phase 1'] = {
        complete: true,
        description: 'Storybook deployed with Text component',
      };
    }

    // Sprint 1 Phase 2
    if (contentToCheck.includes('✅ **Phase 2 Complete**')) {
      phases['Phase 2'] = {
        complete: true,
        description: 'Theme system with 32 themes',
      };
    }

    // Sprint 1 Phase 3
    if (contentToCheck.includes('✅ **Phase 3 Complete**')) {
      phases['Phase 3'] = {
        complete: true,
        description: 'Component gallery deployed',
      };
    }

    // Sprint 1 Phase 4
    if (contentToCheck.includes('✅ **Phase 4 Complete**')) {
      phases['Phase 4'] = {
        complete: true,
        description: 'PWA features with testing and monitoring',
      };
    }

    // Extract Sprint 2 phase statuses
    const sprint2Phases: TaskProgress['sprint2Phases'] = {};

    // Sprint 2 is 100% complete (65/65 tasks per constitution.md)
    // Hardcode all phases as complete since T001-T060 tasks are not in current TASKS.md
    sprint2Phases['Phase 1'] = {
      complete: true,
      description: `Testing Foundation (Weeks 1-2) - 12/12 tasks`,
    };

    sprint2Phases['Phase 2'] = {
      complete: true,
      description: `Developer Experience (Weeks 3-4) - 12/12 tasks`,
    };

    sprint2Phases['Phase 3'] = {
      complete: true,
      description: `First Simple Feature (Weeks 5-6) - 12/12 tasks`,
    };

    sprint2Phases['Phase 4'] = {
      complete: true,
      description: `Quality Baseline (Weeks 7-8) - 12/12 tasks`,
    };

    // Note: Sprint 2 had 65 total tasks, with 5 additional tasks beyond the 60 in phases
    sprint2Phases['Phase 5'] = {
      complete: true,
      description: `Foundation Completion (Weeks 9-10) - 12/12 tasks`,
    };

    // Calculate overall totals from all sprints (should be 290 total)
    const overallTotalTasks = sprints.reduce(
      (sum, sprint) => sum + sprint.totalTasks,
      0
    );
    const overallCompletedTasks = sprints.reduce(
      (sum, sprint) => sum + sprint.completedTasks,
      0
    );
    const overallPercentage =
      overallTotalTasks > 0
        ? Math.round((overallCompletedTasks / overallTotalTasks) * 100)
        : 0;

    return {
      totalTasks: overallTotalTasks,
      completedTasks: overallCompletedTasks,
      percentage: overallPercentage,
      phases,
      sprint2Phases,
      lastUpdated,
      sprints,
    };
  } catch (error) {
    console.error('Failed to parse TASKS.md:', error);
    // Throw error instead of returning fallback data
    throw error;
  }
}
