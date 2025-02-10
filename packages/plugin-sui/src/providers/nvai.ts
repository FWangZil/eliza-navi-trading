import { IAgentRuntime, Provider } from "@elizaos/core";
import { AccountManager, NAVISDKClient } from "navi-sdk";

export interface NaviProtocolWarp {
    account: AccountManager;
    client: NAVISDKClient;
    apiKey: string;
}

export class NaviProtocolProvider {
    private warper: NaviProtocolWarp;

    constructor(
        private mnemonic: string,
        private network: string,
        private apiKey: string
    ) {
        const client = new NAVISDKClient({
            mnemonic,
            networkType: network ?? "mainnet",
            numberOfAccounts: 5,
        });

        this.warper = {
            account: client.accounts[0],
            client,
            apiKey,
        };
    }

    public async get(): Promise<NaviProtocolWarp> {
        return this.warper;
    }
}

const naviProtocolProvider: Provider = {
    async get(runtime: IAgentRuntime): Promise<NaviProtocolWarp> {
        const provider = new NaviProtocolProvider(
            runtime.getSetting("SUI_PRIVATE_KEY") ?? "",
            runtime.getSetting("SUI_NETWORK") ?? "",
            runtime.getSetting("NAVI_API_KEY") ?? ""
        );
        return provider.get();
    },
};

export { naviProtocolProvider };
