export type ServerCommandCallback = (
  isError: boolean,
  responseJson: string,
  errCode: string,
  errMessage: string
) => void;

export interface InvokeServerCommand {
  (
    baseUrl: string,
    appName: string,
    serverCommandName: string,
    requestJson: string,
    ak: string | null | undefined,
    sk: string | null | undefined,
    callback: ServerCommandCallback
  ): Promise<void>;
}

export interface InvokeGeneralApi {
  (
    endpoint: string,
    requestJson: string,
    cookie: string | null | undefined,
    callback: ServerCommandCallback
  ): Promise<void>;
}

export interface HuozigeAppClientApi {
  "invoke-server-command": InvokeServerCommand;
  "invoke-general-api": InvokeGeneralApi;
}
