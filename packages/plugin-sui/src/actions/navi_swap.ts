import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
    elizaLogger,
    generateObject,
    type Action,
} from "@elizaos/core";
import { z } from "zod";

import { naviProtocolProvider, NaviProtocolWarp } from "../providers/nvai";
import { SUI_DECIMALS } from "@mysten/sui/utils";

export interface SwapContent extends Content {
    fromCoinAddress: string;
    toCoinAddress: string;
    amount: string | number;
    minAmountOut: string | number;
}

function isSwapContent(content: Content): content is SwapContent {
    console.log("Content for swap", content);
    return (
        typeof content.fromCoinAddress === "string" &&
        typeof content.toCoinAddress === "string" &&
        (typeof content.amount === "string" ||
            typeof content.amount === "number")
    );
}

const swapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
  "fromCoinAddress": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  "toCoinAddress": "0x2::sui::SUI",
  "amount": "100",
  "minAmountOut": "95"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token swap:
- The source token's address (fromCoinAddress)
- The destination token's address (toCoinAddress)
- The amount to swap (amount)
- The minimum amount expected out from the swap (minAmountOut)

Respond with a JSON markdown block containing only these extracted values.`;

export default {
    name: "NAVI_SWAP_TOKEN",
    similes: ["SWAP_TOKEN"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating sui swap from user:", message.userId);
        return true;
    },
    description: "Swap fromCoinAddress toCoinAddress",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SWAP_TOKEN handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Define the schema for the expected output
        const swapSchema = z.object({
            fromCoinAddress: z.string(),
            toCoinAddress: z.string(),
            amount: z.union([z.string(), z.number()]),
            minAmountOut: z.union([z.string(), z.number()]),
        });

        // Compose swap context
        const swapContext = composeContext({
            state,
            template: swapTemplate,
        });

        // Generate swap content with the schema
        const content = await generateObject({
            runtime,
            context: swapContext,
            schema: swapSchema,
            modelClass: ModelClass.LARGE,
        });

        const swapContent = content.object as SwapContent;

        console.log("Swap content:", swapContent);

        // Validate swap content
        if (!isSwapContent(swapContent)) {
            console.error("Invalid content for SWAP_TOKEN action.");
            if (callback) {
                callback({
                    text: "Unable to process swap request. Invalid content provided.",
                    content: { error: "Invalid swap content" },
                });
            }
            return false;
        }

        try {
            const inDecimals =
                swapContent.fromCoinAddress.toLowerCase().includes("usdc") ||
                swapContent.fromCoinAddress.toLowerCase().includes("usdt")
                    ? 6
                    : SUI_DECIMALS;

            const adjustedAmount = BigInt(
                Number(swapContent.amount) * Math.pow(10, inDecimals)
            );

            const outDecimals =
                swapContent.toCoinAddress.toLowerCase().includes("usdc") ||
                swapContent.toCoinAddress.toLowerCase().includes("usdt")
                    ? 6
                    : SUI_DECIMALS;

            const adjustedMinAmountOut =
                Number(swapContent.minAmountOut) * Math.pow(10, outDecimals);

            const naviWarp = (await naviProtocolProvider.get(
                runtime,
                message
            )) as NaviProtocolWarp;
            const account = naviWarp.account;
            const client = naviWarp.client;
            const apiKey = naviWarp.apiKey;

            console.log("account:", account.address);

            //get quote
            client
                .getQuote(
                    swapContent.fromCoinAddress,
                    swapContent.toCoinAddress,
                    adjustedAmount,
                    apiKey
                )
                .then((quote) => {
                    console.log("quote:", quote);
                });

            //dry run swap
            account
                .dryRunSwap(
                    swapContent.fromCoinAddress,
                    swapContent.toCoinAddress,
                    adjustedAmount,
                    adjustedMinAmountOut,
                    apiKey
                )
                .then((result) => {
                    console.log("dryRunSwap:", result);
                });

            // swap and execute this on chain
            account
                .swap(
                    swapContent.fromCoinAddress,
                    swapContent.toCoinAddress,
                    adjustedAmount,
                    adjustedMinAmountOut,
                    apiKey
                )
                .then((result) => {
                    console.log("swap result:", result);
                });

            if (callback) {
                callback({
                    text: `Successfully swap ${swapContent.amount} ${swapContent.fromCoinAddress} to ${swapContent.toCoinAddress}`,
                    content: {
                        success: true,
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during token swap:", error);
            if (callback) {
                callback({
                    text: `Error swap tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to swap 100 [0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC] to [0x2::sui::SUI] with a minimum receive of 95 tokens.",
                    action: "SWAP_TOKEN",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Initiating swap operation...",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Swap executed successfully: 100 0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC swapped to 0x2::sui::SUI with a minimum of 95 tokens received. Transaction ID: 0x12345abcde",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
