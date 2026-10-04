import { serveDataset } from "@/features/atlas/server/public-api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return serveDataset(request);
}
