import { createPrivilegedClient, type PrivilegedClient } from "@/lib/privileged-client";
import { createRequestClient, type RequestClient } from "@/lib/request-client";

export type RequestAndPrivilegedClients = {
  requestClient: RequestClient | null;
  privilegedClient: PrivilegedClient | null;
};

export async function createRequestAndPrivilegedClients(): Promise<RequestAndPrivilegedClients> {
  const requestClient = await createRequestClient();
  const privilegedClient = createPrivilegedClient();

  return { requestClient, privilegedClient };
}
