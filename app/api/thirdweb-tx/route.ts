import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { smartWallet, privateKeyAccount } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { sendTransaction, prepareTransaction } from "thirdweb";
import { generatePrivateKey } from "viem/accounts";
import { parseEther } from "viem";

// Pre-create client and account (cache these)
let cachedClient: any = null;
let cachedAccount: any = null;

export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    
    const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
    const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    
    if (!THIRDWEB_SECRET_KEY) {
      return NextResponse.json({ error: "Missing THIRDWEB_SECRET_KEY" }, { status: 500 });
    }

    // Use cached client or create once
    if (!cachedClient) {
      cachedClient = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
    }

    // Use cached account or create once
    if (!cachedAccount) {
      const privateKey = generatePrivateKey();
      const personalAccount = privateKeyAccount({ client: cachedClient, privateKey });
      const wallet = smartWallet({ chain: baseSepolia, sponsorGas: true });
      cachedAccount = await wallet.connect({ client: cachedClient, personalAccount });
    }

    const transaction = prepareTransaction({
      client: cachedClient,
      chain: baseSepolia,
      to: VITALIK_ADDRESS,
      value: parseEther("0"),
      data: "0x",
    });

    const { transactionHash } = await sendTransaction({
      transaction,
      account: cachedAccount,
    });

    const processingTime = Date.now() - startTime;
    console.log(`[Thirdweb API] Processing time: ${processingTime}ms`);

    return NextResponse.json({ 
      transactionHash, 
      smartAccount: cachedAccount.address,
      processingTime 
    });
  } catch (error: any) {
    console.error("[Thirdweb API] Error:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
} 