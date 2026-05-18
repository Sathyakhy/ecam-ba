import { createFileRoute } from "@tanstack/react-router";
import { ProjectOverview } from "@/components/project/project-overview";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { projectId } = Route.useParams();
  return <ProjectOverview projectId={projectId} />;
}
