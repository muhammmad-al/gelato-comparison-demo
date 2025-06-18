"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { createKernelAccount, createKernelAccountClient, getUserOperationGasPrice } from "@zerodev/sdk"
import { createPublicClient, http, formatEther, formatUnits } from "viem"
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

const zeroAddress = "0x0000000000000000000000000000000000000000";

export default function Component() {
  const [sdks, setSdks] = useState([
    {
      name: "Gelato SmartWallet SDK",
      icon: "/gelato-logo.svg",
      iconBg: "bg-red-500",
      isLogo: true,
      latency: "-",
      latencyBadge: null,
      l1Gas: "-",
      l1GasBadge: null,
      l2Gas: "-",
      l2GasBadge: null,
      chains: "-",
      eip7702: "-",
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
      chains: "-",
      eip7702: "-",
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
      chains: "-",
      eip7702: "-",
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
      chains: "-",
      eip7702: "-",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [ultraAccount, setUltraAccount] = useState<any>(null)
  const [ultraClient, setUltraClient] = useState<any>(null)
  const [alchemyAccount, setAlchemyAccount] = useState<any>(null)
  const [alchemyClient, setAlchemyClient] = useState<any>(null)
  const [pimlicoAccount, setPimlicoAccount] = useState<any>(null)
  const [pimlicoClient, setPimlicoClient] = useState<any>(null)

  const metrics = [
    { label: "Latency (s)", key: "latency", badgeKey: "latencyBadge" },
    { label: "L1 gas", key: "l1Gas", badgeKey: "l1GasBadge" },
    { label: "L2 gas", key: "l2Gas", badgeKey: "l2GasBadge" },
    { label: "# Chains", key: "chains", badgeKey: null },
    { label: "Purpose-built for EIP-7702", key: "eip7702", badgeKey: null },
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
      const startTime = Date.now()
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
      const userOpHash = await kernelClient.sendUserOperation({
        callData,
        maxFeePerGas: BigInt(0),
        maxPriorityFeePerGas: BigInt(0),
      })
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })
      const txHash = receipt.receipt.transactionHash
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const txReceipt = await client.getTransactionReceipt({
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
          transport: http(RPC_URL, { timeout: 30000 }),
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
      const result: SendUserOperationResult = await smartAccountClient.sendUserOperation({
        uo: {
          target: zeroAddress,
          data: "0x",
          value: 0n,
        },
      })
      const txHash = await smartAccountClient.waitForUserOperationTransaction(result)
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const txReceipt = await client.getTransactionReceipt({
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
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const txReceipt = await client.getTransactionReceipt({
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
    } catch (error) {
      console.error("Error in Pimlico transaction:", error)
      toast({
        title: "Error",
        description: "Failed to send Pimlico transaction. See console for details.",
        variant: "destructive",
      })
    }
  }

  // Run all three in parallel
  const runAllSponsoredTransactions = async () => {
    setIsLoading(true)
    await Promise.all([
      runUltraRelaySponsoredTransaction(),
      runAlchemySponsoredTransaction(),
      runPimlicoSponsoredTransaction(),
    ])
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            {isLoading ? "Running..." : "Run Sponsored Transaction"}
          </Button>
        </div>
      </div>
    </div>
  )
} 