import { NextRequest, NextResponse } from "next/server";
import { createThirdwebClient } from "thirdweb";
import { smartWallet, privateKeyAccount } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { sendTransaction, prepareTransaction } from "thirdweb";
import { generatePrivateKey } from "viem/accounts";
import { parseEther } from "viem";

export async function POST(req: NextRequest) {
  try {
    const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
    const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    if (!THIRDWEB_SECRET_KEY) {
      return NextResponse.json({ error: "Missing THIRDWEB_SECRET_KEY" }, { status: 500 });
    }

    const privateKey = generatePrivateKey();
    const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
    const personalAccount = privateKeyAccount({ client, privateKey });
    const wallet = smartWallet({ chain: baseSepolia, sponsorGas: true });
    const smartAccount = await wallet.connect({ client, personalAccount });

    const transaction = prepareTransaction({
      client,
      chain: baseSepolia,
      to: VITALIK_ADDRESS,
      value: parseEther("0"),
      data: "0x",
    });

    const { transactionHash } = await sendTransaction({
      transaction,
      account: smartAccount,
    });

    return NextResponse.json({ transactionHash, smartAccount: smartAccount.address });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
} 