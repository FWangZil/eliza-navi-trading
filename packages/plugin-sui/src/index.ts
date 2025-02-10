import { Plugin } from "@elizaos/core";
import naviSwap from "./actions/navi_swap.ts";
import { naviProtocolProvider } from "./providers/nvai.ts";

export { naviSwap as NaviSwap };

export const suiPlugin: Plugin = {
    name: "sui",
    description: "Sui Plugin for Eliza",
    actions: [naviSwap],
    evaluators: [],
    providers: [naviProtocolProvider],
};

export default suiPlugin;
