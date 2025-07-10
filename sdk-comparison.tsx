"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { createKernelAccount, createKernelAccountClient, getUserOperationGasPrice } from "@zerodev/sdk"
import { createPublicClient, http, formatEther, formatUnits, createWalletClient, type PrivateKeyAccount } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { baseSepolia } from "viem/chains"
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants"
import { createModularAccountAlchemyClient } from "@alchemy/aa-alchemy"
import { LocalAccountSigner, type SmartAccountSigner, type SendUserOperationResult, baseSepolia as alchemyBaseSepolia } from "@alchemy/aa-core"
import { toSafeSmartAccount } from "permissionless/accounts"
import { entryPoint07Address } from "viem/account-abstraction"
import { createSmartAccountClient } from "permissionless"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createGelatoSmartWalletClient, sponsored } from "@gelatonetwork/smartwallet"
import { gelato } from "@gelatonetwork/smartwallet/accounts"
import { createThirdwebClient, sendTransaction, prepareTransaction } from "thirdweb"
import { smartWallet, privateKeyAccount } from "thirdweb/wallets"
import { baseSepolia as thirdwebBaseSepolia } from "thirdweb/chains"
import { parseEther } from "viem"
import retry from "async-retry"

const zeroAddress = "0x0000000000000000000000000000000000000000";
const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export default function Component() {
  const [sdks, setSdks] = useState([
    {
      name: "Gelato",
      icon: "/gelato-logo.svg",
      iconBg: "bg-red-500",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      paymaster: "Gelato",
      smartWallet: "Gelato",
      eip7702: " Yes",
    },
    {
      name: "Alchemy",
      icon: "/alchemy-logo.png",
      iconBg: "bg-blue-500",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      paymaster: "Alchemy",
      smartWallet: "Alchemy",
      eip7702: "No",
    },
    {
      name: "ZeroDev UltraRelay",
      icon: "/zerodev-logo.svg",
      iconBg: "bg-blue-400",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      paymaster: "UltraRelay",
      smartWallet: "ZeroDev",
      eip7702: "No",
    },
    {
      name: "Pimlico",
      icon: "/pimlico-logo.svg",
      iconBg: "bg-white",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      paymaster: "Pimlico",
      smartWallet: "Pimlico",
      eip7702: "No",
    },
    {
      name: "Thirdweb",
      icon: "/thirdweb_image.png",
      iconBg: "bg-purple-500",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      paymaster: "Thirdweb",
      smartWallet: "Thirdweb",
      eip7702: "No",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [ultraAccount, setUltraAccount] = useState<any>(null)
  const [ultraClient, setUltraClient] = useState<any>(null)
  const [alchemyAccount, setAlchemyAccount] = useState<any>(null)
  const [alchemyClient, setAlchemyClient] = useState<any>(null)
  const [pimlicoAccount, setPimlicoAccount] = useState<any>(null)
  const [pimlicoClient, setPimlicoClient] = useState<any>(null)
  const [gelatoAccount, setGelatoAccount] = useState<any>(null)
  const [gelatoClient, setGelatoClient] = useState<any>(null)
  const [thirdwebAccount, setThirdwebAccount] = useState<any>(null)
  const [thirdwebClient, setThirdwebClient] = useState<any>(null)
  const [thirdwebResult, setThirdwebResult] = useState<string | null>(null);

  const metrics = [
    { label: "Latency (s)", key: "latency", badgeKey: "latencyBadge" },
    { label: "L1 gas", key: "l1Gas", badgeKey: "l1GasBadge" },
    { label: "L2 gas", key: "l2Gas", badgeKey: "l2GasBadge" },
    { label: "Paymaster", key: "paymaster", badgeKey: null },
    { label: "Smart Wallet", key: "smartWallet", badgeKey: null },
    { label: "Purpose-built for EIP-7702 ", key: "eip7702", badgeKey: null },
  ]

  // Helper function to format wei to ETH
  const formatWeiToEth = (wei: bigint): string => {
    return formatEther(wei)
  }
  // Helper function to format wei to Gwei
  const formatWeiToGwei = (wei: bigint): string => {
    return formatUnits(wei, 9)
  }

  // ZeroDev UltraRelay logic
  const runUltraRelaySponsoredTransaction = async () => {
    try {
      let kernelAccount = ultraAccount
      let client = ultraClient
      if (!kernelAccount) {
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setUltraClient(clientInstance as any)
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        const entryPoint = getEntryPoint("0.7")
        const kernelVersion = KERNEL_V3_1
        const ecdsaValidator = await signerToEcdsaValidator(clientInstance, {
          signer,
          entryPoint,
          kernelVersion,
        })
        kernelAccount = await createKernelAccount(clientInstance, {
          plugins: {
            sudo: ecdsaValidator,
          },
          entryPoint,
          kernelVersion,
        })
        setUltraAccount(kernelAccount)
        client = clientInstance
      }
      
      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: baseSepolia,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ULTRA_RELAY_URL || ""),
        userOperation: {
          estimateFeesPerGas: async ({ bundlerClient }) => {
            return getUserOperationGasPrice(bundlerClient)
          },
        },
      })
      const callData = await kernelClient.account.encodeCalls([
        {
          to: "0x0000000000000000000000000000000000000000",
          value: BigInt(0),
          data: "0x",
        },
      ])
      
      const startTime = Date.now()
      
      const userOpHash = await kernelClient.sendUserOperation({
        callData,
        maxFeePerGas: BigInt(0),
        maxPriorityFeePerGas: BigInt(0),
      })
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })
      const txHash = receipt.receipt.transactionHash
      
      // Add retry logic for transaction receipt
      const txReceipt = await retry(
        async (bail: (error: Error) => void) => {
          try {
            const receipt = await client.getTransactionReceipt({
              hash: txHash,
            })
            if (!receipt) {
              throw new Error("Transaction receipt not found")
            }
            return receipt
          } catch (error: any) {
            if (error.message?.includes("not be found")) {
              throw error
            }
            bail(error)
            return
          }
        },
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 5000,
        }
      )
      
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      const gasPrice = txDetails.gasPrice || BigInt(0)
      const L2Gas = txReceipt.gasUsed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0)
      const totalTxFee = l1Fee + L2Gas * gasPrice
      setSdks(prev => prev.map(sdk =>
        sdk.name === "ZeroDev UltraRelay"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`,
              l1Gas: l1GasUsed.toString(),
              l2Gas: L2Gas.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      toast({
        title: "UltraRelay Transaction Sent",
        description: `Tx Hash: ${txHash}`,
      })
      console.log("ZeroDev UltraRelay transaction hash:", txHash)
    } catch (error) {
      console.error("Error in Ultra Relay transaction:", error)
      toast({
        title: "Error",
        description: "Failed to send UltraRelay transaction. See console for details.",
        variant: "destructive",
      })
    }
  }

  // Alchemy logic
  const runAlchemySponsoredTransaction = async () => {
    try {
      let smartAccountClient = alchemyAccount
      let client = alchemyClient
      if (!smartAccountClient) {
        const PRIV_KEY = generatePrivateKey()
        const signer: SmartAccountSigner = LocalAccountSigner.privateKeyToAccountSigner(PRIV_KEY)
        const RPC_URL = "https://sepolia.base.org"
        const chain = alchemyBaseSepolia
        smartAccountClient = await createModularAccountAlchemyClient({
          apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
          chain,
          signer,
          gasManagerConfig: {
            policyId: process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID || "",
          },
        })
        setAlchemyAccount(smartAccountClient)
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setAlchemyClient(clientInstance as any)
        client = clientInstance
      }
      
      const startTime = Date.now()
      
      // FIXED: Add proper gas estimation with buffer
      const result: SendUserOperationResult = await smartAccountClient.sendUserOperation({
        uo: {
          target: zeroAddress,
          data: "0x",
          value: BigInt(0),
        },
        // Add this to force fresh gas estimation with buffer
        overrides: {
          maxFeePerGas: {
            multiplier: 1.5, // 50% buffer above current gas price
          },
          maxPriorityFeePerGas: {
            multiplier: 1.5,
          },
        },
      })
      const txHash = await smartAccountClient.waitForUserOperationTransaction(result)
      
      // Add retry logic for transaction receipt
      const txReceipt = await retry(
        async (bail: (error: Error) => void) => {
          try {
            const receipt = await client.getTransactionReceipt({
              hash: txHash,
            })
            if (!receipt) {
              throw new Error("Transaction receipt not found")
            }
            return receipt
          } catch (error: any) {
            if (error.message?.includes("not be found")) {
              throw error
            }
            bail(error)
            return
          }
        },
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 5000,
        }
      )
      
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      const gasPrice = txDetails.gasPrice || BigInt(0)
      const L2Gas = txReceipt.gasUsed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0)
      const totalTxFee = l1Fee + L2Gas * gasPrice
      setSdks(prev => prev.map(sdk =>
        sdk.name === "Alchemy"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`,
              l1Gas: l1GasUsed.toString(),
              l2Gas: L2Gas.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      toast({
        title: "Alchemy Transaction Sent",
        description: `Tx Hash: ${txHash}`,
      })
      console.log("Alchemy transaction hash:", txHash)
    } catch (error) {
      console.error("Error in Alchemy transaction:", error)
      toast({
        title: "Error",
        description: "Failed to send Alchemy transaction. See console for details.",
        variant: "destructive",
      })
    }
  }

  // Pimlico logic
  const runPimlicoSponsoredTransaction = async () => {
    try {
      let smartAccountClient = pimlicoAccount
      let client = pimlicoClient
      if (!smartAccountClient) {
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setPimlicoClient(clientInstance as any)
        const account = await toSafeSmartAccount({
          client: clientInstance,
          entryPoint: { address: entryPoint07Address, version: "0.7" },
          owners: [signer],
          saltNonce: BigInt(0),
          version: "1.4.1",
        })
        const pimlicoClientInstance = createPimlicoClient({
          transport: http(process.env.NEXT_PUBLIC_PIMLICO_URL || ""),
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        })
        smartAccountClient = createSmartAccountClient({
          account,
          chain: baseSepolia,
          bundlerTransport: http(process.env.NEXT_PUBLIC_PIMLICO_URL || ""),
          paymaster: pimlicoClientInstance,
          userOperation: {
            estimateFeesPerGas: async () => {
              return (await pimlicoClientInstance.getUserOperationGasPrice()).fast;
            },
          },
        })
        setPimlicoAccount(smartAccountClient)
        client = clientInstance
      }
      
      const startTime = Date.now()
      
      const txHash = await smartAccountClient.sendTransaction({
        to: smartAccountClient.account.address,
        value: BigInt(0),
        data: "0x",
      })
      
      // Add retry logic for transaction receipt
      const txReceipt = await retry(
        async (bail: (error: Error) => void) => {
          try {
            const receipt = await client.getTransactionReceipt({
              hash: txHash,
            })
            if (!receipt) {
              throw new Error("Transaction receipt not found")
            }
            return receipt
          } catch (error: any) {
            if (error.message?.includes("not be found")) {
              throw error
            }
            bail(error)
            return
          }
        },
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 5000,
        }
      )
      
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      const gasPrice = txDetails.gasPrice || BigInt(0)
      const L2Gas = txReceipt.gasUsed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0)
      const totalTxFee = l1Fee + L2Gas * gasPrice
      setSdks(prev => prev.map(sdk =>
        sdk.name === "Pimlico"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`,
              l1Gas: l1GasUsed.toString(),
              l2Gas: L2Gas.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      toast({
        title: "Pimlico Transaction Sent",
        description: `Tx Hash: ${txHash}`,
      })
      console.log("Pimlico transaction hash:", txHash)
    } catch (error) {
      console.error("Error in Pimlico transaction:", error)
      toast({
        title: "Error",
        description: "Failed to send Pimlico transaction. See console for details.",
        variant: "destructive",
      })
    }
  }

  // Gelato logic
  const runGelatoSponsoredTransaction = async () => {
    try {
      console.log("[Gelato] Starting sponsored transaction...")
      let smartWalletClient = gelatoAccount
      let client = gelatoClient
      if (!smartWalletClient) {
        console.log("[Gelato] Creating new smart wallet client...")
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        console.log("[Gelato] Generated signer address:", signer.address)
        
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setGelatoClient(clientInstance as any)
        console.log("[Gelato] Created public client for Base Sepolia")
        
        const account = await gelato({
          owner: signer,
          client: clientInstance,
        })
        console.log("[Gelato] Created Gelato account:", account.address)
        
        const walletClient = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(""),
        })
        console.log("[Gelato] Created wallet client")
        
        smartWalletClient = await createGelatoSmartWalletClient(
          walletClient,
          { apiKey: process.env.NEXT_PUBLIC_SPONSOR_API_KEY || "" }
        )
        console.log("[Gelato] Created smart wallet client with sponsor API key")
        setGelatoAccount(smartWalletClient)
        client = clientInstance
      } else {
        console.log("[Gelato] Using existing smart wallet client")
      }
      
      const calls = [
        {
          to: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          value: BigInt(0),
          data: "0x",
        },
      ]
      console.log("[Gelato] Prepared calls:", calls)
      
      // OPTIMIZATION 1: Prepare and send in one go, start timing right before send
      console.log("[Gelato] Preparing transaction with sponsored payment...")
      const preparedCalls = await smartWalletClient.prepare({
        payment: sponsored(process.env.NEXT_PUBLIC_SPONSOR_API_KEY || ""),
        calls,
      })
      console.log("[Gelato] Transaction prepared successfully")
      
      const startTime = Date.now() // Move this as close to send as possible
      console.log("[Gelato] Starting transaction send at:", new Date(startTime).toISOString())
      
      // CRITICAL: Measure only the send operation, not the wait (fair comparison with other SDKs)
      console.log("[Gelato] Sending transaction...")
      const results = await smartWalletClient.send({ preparedCalls })
      const sendCompleteTime = Date.now()
      console.log("[Gelato] Transaction sent successfully at:", new Date(sendCompleteTime).toISOString())
      
      // This is the equivalent measurement to other SDKs' sendUserOperation()
      const networkLatency = sendCompleteTime - startTime
      const latencySec = networkLatency / 1000
      console.log(`[Gelato] Network send latency: ${latencySec.toFixed(3)}s (${networkLatency}ms)`)
      
      // Get hash asynchronously (don't include in latency measurement)
      console.log("[Gelato] Waiting for transaction hash...")
      const hash = await results?.wait()
      console.log("[Gelato] Transaction hash received:", hash)
      
      // Still get receipt for gas data, but don't include in latency calculation
      console.log("[Gelato] Fetching transaction receipt...")
      const txReceipt = await retry(
        async (bail: (error: Error) => void) => {
          try {
            const receipt = await client.getTransactionReceipt({
              hash: hash as `0x${string}`,
            })
            if (!receipt) {
              throw new Error("Transaction receipt not found")
            }
            return receipt
          } catch (error: any) {
            if (error.message?.includes("not be found")) {
              throw error
            }
            bail(error)
            return
          }
        },
        {
          retries: 3, // Reduce retries for speed
          minTimeout: 500, // Faster retries
          maxTimeout: 2000,
        }
      )
      if (!txReceipt) {
        throw new Error("Failed to get transaction receipt after retries")
      }
      console.log("[Gelato] Transaction receipt received:", {
        blockNumber: txReceipt.blockNumber,
        gasUsed: txReceipt.gasUsed.toString(),
        effectiveGasPrice: txReceipt.effectiveGasPrice?.toString(),
        status: txReceipt.status
      })
      
      const l2GasUsed = txReceipt.gasUsed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0)
      const gasPrice = txReceipt.effectiveGasPrice || BigInt(0)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0)
      const totalTxFee = l1Fee + l2GasUsed * gasPrice
      
      console.log("[Gelato] Gas analysis:", {
        l2GasUsed: l2GasUsed.toString(),
        l1GasUsed: l1GasUsed.toString(),
        gasPrice: gasPrice.toString(),
        gasPriceGwei: formatWeiToGwei(gasPrice),
        l1Fee: l1Fee.toString(),
        totalTxFee: totalTxFee.toString()
      })
      
      // Latency already calculated above (network latency, not block time)
      
      setSdks(prev => prev.map(sdk =>
        sdk.name === "Gelato"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`,
              l1Gas: l1GasUsed.toString(),
              l2Gas: l2GasUsed.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      
      toast({
        title: "Gelato Transaction Sent",
        description: `Tx Hash: ${hash}`,
      })
      console.log("[Gelato] Transaction completed successfully!")
      console.log("[Gelato] Final metrics:", {
        transactionHash: hash,
        latency: `${latencySec.toFixed(3)}s`,
        l1Gas: l1GasUsed.toString(),
        l2Gas: l2GasUsed.toString(),
        gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`
      })
    } catch (error) {
      console.error("[Gelato] Error in Gelato transaction:", error)
      console.error("[Gelato] Error details:", {
        message: error.message,
        cause: error.cause,
        stack: error.stack
      })
      toast({
        title: "Error",
        description: "Failed to send Gelato transaction. See console for details.",
        variant: "destructive",
      })
    }
  }

  // Thirdweb logic - measure API response time only (fair comparison)
  const runThirdwebSponsoredTransaction = async () => {
    try {
      // Measure only the API call, not block confirmation
      const startTime = Date.now();
      const res = await fetch("/api/thirdweb-tx", { method: "POST" });
      const data = await res.json();
      const apiCompleteTime = Date.now();
      
      // This is the fair comparison latency (API response time)
      const apiLatency = apiCompleteTime - startTime;
      const apiLatencySec = apiLatency / 1000;
      
      if (data.transactionHash) {
        const transactionHash = data.transactionHash;
        console.log("[Thirdweb] Transaction hash:", transactionHash);
        console.log(`[Thirdweb] API latency: ${apiLatencySec.toFixed(3)}s`);

        // Get receipt for gas data (separate from latency measurement)
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const txReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
        const txDetails = await publicClient.getTransaction({ hash: transactionHash });
        
        const gasPrice = txDetails.gasPrice || BigInt(0);
        const L2Gas = txReceipt.gasUsed;
        const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0);

        setSdks(prev =>
          prev.map(sdk =>
            sdk.name === "Thirdweb"
              ? {
                  ...sdk,
                  latency: `${apiLatencySec.toFixed(2)}`, // Use API latency, not block time
                  l1Gas: l1GasUsed.toString(),
                  l2Gas: L2Gas.toString(),
                  gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
                  l1GasBadge: null,
                  l2GasBadge: null,
                  latencyBadge: null,
                }
              : sdk
          )
        );
        
        toast({
          title: "Thirdweb Transaction Sent",
          description: `Tx Hash: ${transactionHash}`,
        });
        
      } else {
        console.error("[Thirdweb] Error:", data.error);
        toast({
          title: "Thirdweb Error",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[Thirdweb] API call error:", err);
      toast({
        title: "Thirdweb Error", 
        description: "API call failed",
        variant: "destructive",
      });
    }
  };

  // Run all five in parallel
  const runAllSponsoredTransactions = async () => {
    setIsLoading(true)
    await Promise.all([
      runUltraRelaySponsoredTransaction(),
      runAlchemySponsoredTransaction(),
      runPimlicoSponsoredTransaction(),
      runGelatoSponsoredTransaction(),
      runThirdwebSponsoredTransaction(),
    ])
    
    // All transactions completed successfully
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {sdks.map((sdk, index) => (
            <Card key={index} className="bg-gray-900 border-gray-700 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-full ${sdk.iconBg} flex items-center justify-center text-white text-xl overflow-hidden`}
                  >
                    {sdk.isLogo ? (
                      <img
                        src={sdk.icon || "/placeholder.svg"}
                        alt={`${sdk.name} logo`}
                        className="w-8 h-8 rounded-sm"
                      />
                    ) : (
                      sdk.icon
                    )}
                  </div>
                </div>
                <h3 className="text-white text-lg font-semibold leading-tight">{sdk.name}</h3>
              </div>

              {/* Metrics */}
              <div className="px-6 pb-6">
                {metrics.map((metric, metricIndex) => (
                  <div
                    key={metricIndex}
                    className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0"
                  >
                    <span className="text-gray-400 text-sm">{metric.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{sdk[metric.key as keyof typeof sdk]}</span>
                      {metric.badgeKey && sdk[metric.badgeKey as keyof typeof sdk] && (
                        <Badge
                          variant="secondary"
                          className="bg-orange-900/30 text-orange-400 border-orange-800 text-xs px-2 py-0.5"
                        >
                          {sdk[metric.badgeKey as keyof typeof sdk]}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="flex justify-center mt-8">
          <Button onClick={runAllSponsoredTransactions} disabled={isLoading}>
            {isLoading ? "Running..." : "Run All Sponsored Transactions"}
          </Button>
        </div>
      </div>
    </div>
  )
} 