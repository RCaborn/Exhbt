import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export default async function RoadmapIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roadmap");
  const latest = await getStore().latestRoadmapFor(user.id);
  redirect(latest ? `/roadmap/${latest.id}` : "/roadmap/new");
}
