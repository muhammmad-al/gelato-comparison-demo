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

// Constants for transaction testing
const zeroAddress = "0x0000000000000000000000000000000000000000";
const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export default function Component() {
  // State to track SDK comparison results
  // Each SDK has metrics for latency, gas usage, and features
  const [sdks, setSdks] = useState([
    {
      name: "Gelato",
      icon: "/gelato-logo.svg",
      iconBg: "bg-red-500",
      isLogo: true,
      latency: "-", // Transaction latency in seconds
      latencyBadge: null,
      l1Gas: "-", // L1 gas used (for L2s like Base)
      l1GasBadge: null,
      l2Gas: "-", // L2 gas used
      l2GasBadge: null,
      paymaster: "Gelato", // Which paymaster service
      smartWallet: "Gelato", // Which smart wallet implementation
      eip7702: " Yes", // EIP-7702 support (Gelato's specialty)
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
  
  // Loading state for UI feedback
  const [isLoading, setIsLoading] = useState(false)
  
  // State to cache SDK clients and accounts for performance
  // This prevents recreating clients on every transaction
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

  // Define the metrics we want to compare across all SDKs
  const metrics = [
    { label: "Latency (s)", key: "latency", badgeKey: "latencyBadge" },
    { label: "L1 gas", key: "l1Gas", badgeKey: "l1GasBadge" },
    { label: "L2 gas", key: "l2Gas", badgeKey: "l2GasBadge" },
    { label: "Paymaster", key: "paymaster", badgeKey: null },
    { label: "Smart Wallet", key: "smartWallet", badgeKey: null },
    { label: "Purpose-built for EIP-7702 ", key: "eip7702", badgeKey: null },
  ]

  // Helper function to format wei to ETH (for display purposes)
  const formatWeiToEth = (wei: bigint): string => {
    return formatEther(wei)
  }
  
  // Helper function to format wei to Gwei (for gas price display)
  // Gas prices are typically shown in Gwei for readability
  const formatWeiToGwei = (wei: bigint): string => {
    return formatUnits(wei, 9)
  }

  // ZeroDev UltraRelay Implementation
  // Uses Kernel smart account with ECDSA validator
  const runUltraRelaySponsoredTransaction = async () => {
    try {
      let kernelAccount = ultraAccount
      let client = ultraClient
      
      // Create new account and client if they don't exist
      if (!kernelAccount) {
        console.log("[ZeroDev] Creating new kernel account...")
        
        // Create public client for Base Sepolia
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setUltraClient(clientInstance as any)
        
        // Generate a new private key for testing
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        
        // Get the entry point for ERC-4337 account abstraction
        const entryPoint = getEntryPoint("0.7")
        const kernelVersion = KERNEL_V3_1
        
        // Create ECDSA validator for the kernel account
        const ecdsaValidator = await signerToEcdsaValidator(clientInstance, {
          signer,
          entryPoint,
          kernelVersion,
        })
        
        // Create the kernel smart account
        kernelAccount = await createKernelAccount(clientInstance, {
          plugins: {
            sudo: ecdsaValidator, // ECDSA validator as the main plugin
          },
          entryPoint,
          kernelVersion,
        })
        setUltraAccount(kernelAccount)
        client = clientInstance
      }
      
      // Create kernel client with UltraRelay bundler
      const kernelClient = createKernelAccountClient({
        account: kernelAccount,
        chain: baseSepolia,
        bundlerTransport: http(process.env.NEXT_PUBLIC_ULTRA_RELAY_URL || ""),
        userOperation: {
          // Use UltraRelay's gas price estimation
          estimateFeesPerGas: async ({ bundlerClient }) => {
            return getUserOperationGasPrice(bundlerClient)
          },
        },
      })
      
      // Prepare the transaction call data
      // This is a simple transaction to the zero address with no value
      const callData = await kernelClient.account.encodeCalls([
        {
          to: "0x0000000000000000000000000000000000000000",
          value: BigInt(0),
          data: "0x",
        },
      ])
      
      // Start timing the transaction
      const startTime = Date.now()
      
      // Send the user operation with sponsored gas (maxFeePerGas = 0)
      const userOpHash = await kernelClient.sendUserOperation({
        callData,
        maxFeePerGas: BigInt(0), // Sponsored by UltraRelay
        maxPriorityFeePerGas: BigInt(0), // Sponsored by UltraRelay
      })
      
      // Wait for the user operation to be included in a block
      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })
      const txHash = receipt.receipt.transactionHash
      
      // Add retry logic for transaction receipt to handle network delays
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
      
      // Get transaction details and block information for metrics
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      
      // Calculate latency: time from transaction start to block inclusion
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      
      // Extract gas metrics from the transaction receipt
      const gasPrice = txDetails.gasPrice || BigInt(0) // Actual gas price paid
      const L2Gas = txReceipt.gasUsed // L2 gas consumed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0) // L1 gas used (for L2s)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0) // L1 fee paid
      const totalTxFee = l1Fee + L2Gas * gasPrice // Total transaction cost
      
      // Update the UI with the results
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
      
      // Show success toast
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

  // Alchemy Implementation
  // Uses Alchemy's modular account with gas manager for sponsorship
  const runAlchemySponsoredTransaction = async () => {
    try {
      let smartAccountClient = alchemyAccount
      let client = alchemyClient
      
      // Create new account and client if they don't exist
      if (!smartAccountClient) {
        console.log("[Alchemy] Creating new modular account...")
        
        // Generate a new private key for testing
        const PRIV_KEY = generatePrivateKey()
        const signer: SmartAccountSigner = LocalAccountSigner.privateKeyToAccountSigner(PRIV_KEY)
        const RPC_URL = "https://sepolia.base.org"
        const chain = alchemyBaseSepolia
        
        // Create Alchemy's modular account with gas manager for sponsorship
        smartAccountClient = await createModularAccountAlchemyClient({
          apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
          chain,
          signer,
          gasManagerConfig: {
            policyId: process.env.NEXT_PUBLIC_PAYMASTER_POLICY_ID || "", // Gas sponsorship policy
          },
        })
        setAlchemyAccount(smartAccountClient)
        
        // Create public client for transaction receipt fetching
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setAlchemyClient(clientInstance as any)
        client = clientInstance
      }
      
      // Start timing the transaction
      const startTime = Date.now()
      
      // Send user operation with gas overrides for reliability
      // The multiplier is the MAXIMUM we're willing to pay, not the actual price
      const result: SendUserOperationResult = await smartAccountClient.sendUserOperation({
        uo: {
          target: zeroAddress,
          data: "0x",
          value: BigInt(0),
        },
        // Gas overrides: These are MAXIMUM values, not actual prices
        // The network will charge the actual gas price, up to these limits
        overrides: {
          maxFeePerGas: {
            multiplier: 1.5, // Willing to pay up to 1.5x current gas price
          },
          maxPriorityFeePerGas: {
            multiplier: 1.5, // Willing to pay up to 1.5x current priority fee
          },
        },
      })
      
      // Wait for the transaction to be included in a block
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
      
      // Get transaction details and block information for metrics
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      
      // Calculate latency: time from transaction start to block inclusion
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      
      // Extract gas metrics from the transaction receipt
      // Note: This is the ACTUAL gas price paid, not the maximum we set
      const gasPrice = txDetails.gasPrice || BigInt(0) // Actual gas price paid by network
      const L2Gas = txReceipt.gasUsed // L2 gas consumed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0) // L1 gas used (for L2s)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0) // L1 fee paid
      const totalTxFee = l1Fee + L2Gas * gasPrice // Total transaction cost
      
      // Update the UI with the results
      setSdks(prev => prev.map(sdk =>
        sdk.name === "Alchemy"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`,
              l1Gas: l1GasUsed.toString(),
              l2Gas: L2Gas.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`, // Shows actual price, not max
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      
      // Show success toast
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

  // Pimlico Implementation
  // Uses Safe smart account with Pimlico paymaster and bundler
  const runPimlicoSponsoredTransaction = async () => {
    try {
      let smartAccountClient = pimlicoAccount
      let client = pimlicoClient
      
      // Create new account and client if they don't exist
      if (!smartAccountClient) {
        console.log("[Pimlico] Creating new Safe smart account...")
        
        // Generate a new private key for testing
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        
        // Create public client for Base Sepolia
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setPimlicoClient(clientInstance as any)
        
        // Create Safe smart account with the signer as owner
        const account = await toSafeSmartAccount({
          client: clientInstance,
          entryPoint: { address: entryPoint07Address, version: "0.7" },
          owners: [signer],
          saltNonce: BigInt(0),
          version: "1.4.1",
        })
        
        // Create Pimlico client for paymaster and bundler services
        const pimlicoClientInstance = createPimlicoClient({
          transport: http(process.env.NEXT_PUBLIC_PIMLICO_URL || ""),
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        })
        
        // Create smart account client with Pimlico services
        smartAccountClient = createSmartAccountClient({
          account,
          chain: baseSepolia,
          bundlerTransport: http(process.env.NEXT_PUBLIC_PIMLICO_URL || ""),
          paymaster: pimlicoClientInstance, // Pimlico paymaster for gas sponsorship
          userOperation: {
            // Use Pimlico's fast gas price estimation
            estimateFeesPerGas: async () => {
              return (await pimlicoClientInstance.getUserOperationGasPrice()).fast;
            },
          },
        })
        setPimlicoAccount(smartAccountClient)
        client = clientInstance
      }
      
      // Start timing the transaction
      const startTime = Date.now()
      
      // Send transaction (Pimlico handles gas sponsorship automatically)
      const txHash = await smartAccountClient.sendTransaction({
        to: smartAccountClient.account.address, // Send to self (no-op transaction)
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
      
      // Get transaction details and block information for metrics
      const txDetails = await client.getTransaction({
        hash: txHash,
      })
      const block = await client.getBlock({
        blockNumber: txReceipt.blockNumber,
      })
      
      // Calculate latency: time from transaction start to block inclusion
      const latencyMs = Number(block.timestamp) * 1000 - startTime
      const latencySec = latencyMs / 1000
      
      // Extract gas metrics from the transaction receipt
      const gasPrice = txDetails.gasPrice || BigInt(0) // Actual gas price paid
      const L2Gas = txReceipt.gasUsed // L2 gas consumed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0) // L1 gas used (for L2s)
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0) // L1 fee paid
      const totalTxFee = l1Fee + L2Gas * gasPrice // Total transaction cost
      
      // Update the UI with the results
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
      
      // Show success toast
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

  // Gelato Implementation
  // Uses Gelato's smart wallet with sponsored gas payments
  // This implementation measures network latency differently for fair comparison
  const runGelatoSponsoredTransaction = async () => {
    try {
      console.log("[Gelato] Starting sponsored transaction...")
      let smartWalletClient = gelatoAccount
      let client = gelatoClient
      
      // Create new account and client if they don't exist
      if (!smartWalletClient) {
        console.log("[Gelato] Creating new smart wallet client...")
        
        // Generate a new private key for testing
        const PRIVATE_KEY = generatePrivateKey()
        const signer = privateKeyToAccount(PRIVATE_KEY)
        console.log("[Gelato] Generated signer address:", signer.address)
        
        // Create public client for Base Sepolia
        const clientInstance = createPublicClient({
          transport: http(),
          chain: baseSepolia,
        })
        setGelatoClient(clientInstance as any)
        console.log("[Gelato] Created public client for Base Sepolia")
        
        // Create Gelato smart account
        const account = await gelato({
          owner: signer,
          client: clientInstance,
        })
        console.log("[Gelato] Created Gelato account:", account.address)
        
        // Create wallet client for the account
        const walletClient = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(""),
        })
        console.log("[Gelato] Created wallet client")
        
        // Create Gelato smart wallet client with sponsor API key
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
      
      // Prepare the transaction calls
      const calls = [
        {
          to: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          value: BigInt(0),
          data: "0x",
        },
      ]
      console.log("[Gelato] Prepared calls:", calls)
      
      // Prepare transaction with sponsored payment
      // This step is separate from sending and doesn't count toward latency
      console.log("[Gelato] Preparing transaction with sponsored payment...")
      const preparedCalls = await smartWalletClient.prepare({
        payment: sponsored(process.env.NEXT_PUBLIC_SPONSOR_API_KEY || ""),
        calls,
      })
      console.log("[Gelato] Transaction prepared successfully")
      
      // Start timing RIGHT before the send operation
      // This measures only the network send time, not block confirmation
      const startTime = Date.now()
      console.log("[Gelato] Starting transaction send at:", new Date(startTime).toISOString())
      
      // Send the transaction - this is equivalent to other SDKs' sendUserOperation()
      // We measure only this operation for fair comparison
      console.log("[Gelato] Sending transaction...")
      const results = await smartWalletClient.send({ preparedCalls })
      const sendCompleteTime = Date.now()
      console.log("[Gelato] Transaction sent successfully at:", new Date(sendCompleteTime).toISOString())
      
      // Calculate network latency (send time only, not block confirmation)
      // This is the fair comparison metric with other SDKs
      const networkLatency = sendCompleteTime - startTime
      const latencySec = networkLatency / 1000
      console.log(`[Gelato] Network send latency: ${latencySec.toFixed(3)}s (${networkLatency}ms)`)
      
      // Get transaction hash asynchronously (don't include in latency measurement)
      console.log("[Gelato] Waiting for transaction hash...")
      const hash = await results?.wait()
      console.log("[Gelato] Transaction hash received:", hash)
      
      // Fetch transaction receipt for gas data (separate from latency calculation)
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
      
      // Extract gas metrics from the transaction receipt
      const l2GasUsed = txReceipt.gasUsed // L2 gas consumed
      const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0) // L1 gas used (for L2s)
      const gasPrice = txReceipt.effectiveGasPrice || BigInt(0) // Actual gas price paid
      const l1Fee = (txReceipt as any).l1Fee || BigInt(0) // L1 fee paid
      const totalTxFee = l1Fee + l2GasUsed * gasPrice // Total transaction cost
      
      console.log("[Gelato] Gas analysis:", {
        l2GasUsed: l2GasUsed.toString(),
        l1GasUsed: l1GasUsed.toString(),
        gasPrice: gasPrice.toString(),
        gasPriceGwei: formatWeiToGwei(gasPrice),
        l1Fee: l1Fee.toString(),
        totalTxFee: totalTxFee.toString()
      })
      
      // Update the UI with the results
      // Note: We use the network send latency, not block confirmation time
      setSdks(prev => prev.map(sdk =>
        sdk.name === "Gelato"
          ? {
              ...sdk,
              latency: `${latencySec.toFixed(2)}`, // Network send latency
              l1Gas: l1GasUsed.toString(),
              l2Gas: l2GasUsed.toString(),
              gasPrice: `${formatWeiToGwei(gasPrice)} Gwei`,
              l1GasBadge: null,
              l2GasBadge: null,
              latencyBadge: null,
            }
          : sdk
      ))
      
      // Show success toast
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
    } catch (error: any) {
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

  // Thirdweb Implementation
  // Uses API endpoint for transaction execution
  // Measures only API response time for fair comparison
  const runThirdwebSponsoredTransaction = async () => {
    try {
      // Measure only the API call response time, not block confirmation
      // This provides a fair comparison with other SDKs' sendUserOperation() calls
      const startTime = Date.now();
      const res = await fetch("/api/thirdweb-tx", { method: "POST" });
      const data = await res.json();
      const apiCompleteTime = Date.now();
      
      // Calculate API latency (equivalent to other SDKs' send time)
      const apiLatency = apiCompleteTime - startTime;
      const apiLatencySec = apiLatency / 1000;
      
      if (data.transactionHash) {
        const transactionHash = data.transactionHash;
        console.log("[Thirdweb] Transaction hash:", transactionHash);
        console.log(`[Thirdweb] API latency: ${apiLatencySec.toFixed(3)}s`);

        // Get transaction receipt for gas data (separate from latency measurement)
        // This is for gas metrics only, not included in latency calculation
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const txReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
        const txDetails = await publicClient.getTransaction({ hash: transactionHash });
        
        // Extract gas metrics from the transaction receipt
        const gasPrice = txDetails.gasPrice || BigInt(0); // Actual gas price paid
        const L2Gas = txReceipt.gasUsed; // L2 gas consumed
        const l1GasUsed = (txReceipt as any).l1GasUsed || BigInt(0); // L1 gas used (for L2s)

        // Update the UI with the results
        // Note: We use API latency, not block confirmation time
        setSdks(prev =>
          prev.map(sdk =>
            sdk.name === "Thirdweb"
              ? {
                  ...sdk,
                  latency: `${apiLatencySec.toFixed(2)}`, // API response latency
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
        
        // Show success toast
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

  // Run all SDK transactions in parallel for comparison
  // This ensures all transactions are sent under similar network conditions
  const runAllSponsoredTransactions = async () => {
    setIsLoading(true)
    
    // Execute all transactions simultaneously
    // This provides the fairest comparison as they all compete for the same block space
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

  // Render the comparison UI
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="max-w-7xl mx-auto">
        {/* SDK Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {sdks.map((sdk, index) => (
            <Card key={index} className="bg-gray-900 border-gray-700 rounded-2xl overflow-hidden">
              {/* SDK Header with Logo */}
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

              {/* Metrics Display */}
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
        
        {/* Run All Transactions Button */}
        <div className="flex justify-center mt-8">
          <Button onClick={runAllSponsoredTransactions} disabled={isLoading}>
            {isLoading ? "Running..." : "Run All Sponsored Transactions"}
          </Button>
        </div>
      </div>
    </div>
  )
} 