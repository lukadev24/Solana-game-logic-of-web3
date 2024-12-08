import { AppHero } from '../ui/ui-layout'
import { PublicKey, Transaction, Connection, clusterApiUrl } from '@solana/web3.js';
import { utils } from '@project-serum/anchor';
import { useWallet } from "@solana/wallet-adapter-react"
import { createTransferCheckedInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import axios from "axios";
import toast from 'react-hot-toast'
import * as buffer from "buffer";
import schedule from 'node-schedule';
// import { useEffect } from 'react'

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

window.Buffer = buffer.Buffer;

const connection = new Connection("https://api.devnet.solana.com", 'confirmed');

let mint: String;
let depositAddress: String;
let amount: number;
let amountPlay: number;
let level: number;

// Luka change values 

const walletAddress1 = '38MmnPR4JTuC6RMGteYqN6d5PBqBXEyfvsGes48uoLdy'
// const walletAddress2 = 'NpxdBJPv2rRvFEv7Ke6haYt1BJHr1bPfDauDCNuAzk2'

export default function DashboardFeature() {

  const { publicKey: walletPublicKey, sendTransaction } = useWallet();

  if (!mint || !depositAddress || !amount) {
    console.log('start and get evn');
    try {
      axios.get('/api/game/env')
        .then(response => {
          const { GAME_WALLET_PUBLIC, TOKEN_ADDRESS, AMOUNT } = response.data;
          console.log('Game Wallet Public:', GAME_WALLET_PUBLIC);
          console.log('Token Address:', TOKEN_ADDRESS);
          console.log('Amount:', AMOUNT);
          mint = TOKEN_ADDRESS;
          depositAddress = GAME_WALLET_PUBLIC;
          amount = parseInt(AMOUNT, 10);
        })
        .catch(error => {
          console.error('Error fetching environment variables:', error.message);
        });

    } catch (error) {
      console.error("end failed:", error);
    }
  }



  const dailyTime = '0 6 * * *'; // CRON format for 6:00 AM daily

  schedule.scheduleJob(dailyTime, () => {
    console.log('Task triggered at:', new Date());
    fetchDOPAPrice();
  });


  // Function to fetch the DOPA price
  const fetchDOPAPrice = async (): Promise<void> => {
    const API_URL = 'https://api.coingecko.com/api/v3/simple/price';
    const tokenId = 'dopameme'; // Replace with the actual CoinGecko ID for DOPA
    const queryParams = `?ids=${tokenId}&vs_currencies=usd`;

    try {
      const response = await axios.get(`${API_URL}${queryParams}`);
      const dopaPrice = response.data[tokenId]?.usd;

      if (dopaPrice) {
        console.log(`Current DOPA token price: $${dopaPrice}`);
        const result = 5 / dopaPrice;
        console.log(`Today DOPA amount: ${result.toFixed(2)}`);
        amount = parseInt(result.toFixed(2), 10);
      } else {
        console.log('Price data not available for DOPA token.');
      }
    } catch (error) {
      console.error('Error fetching DOPA token price:', error);
    }
  };

  async function handleTransferBeginner() {
    amountPlay = amount;
    level = 1;
    handleTransfer();
  }
  async function handleTransferCasual() {
    amountPlay = amount * 2;
    level = 2;
    handleTransfer();
  }
  async function handleTransferCompetitive() {
    amountPlay = amount * 4;
    level = 4;
    handleTransfer();
  }
  async function handleTransferElite() {
    amountPlay = amount * 10;
    level = 10;
    handleTransfer();
  }
  async function handleTransferRollers() {
    amountPlay = amount * 20;
    level = 20;
    handleTransfer();
  }

  async function handleTransfer() {
    if (!walletPublicKey) {
      toast.error('You must first connect your wallet');
      return;
    }
    console.log('handleTransfer Button clicked!');


    const solanaPublicKeyString = walletPublicKey.toString();
    console.log('Solana wallet public key (string):', solanaPublicKeyString);

    const ownerPublicKey = publicKey(
      solanaPublicKeyString
    );

    try {
      // Create a UMI instance
      const umi = createUmi(clusterApiUrl("devnet"));

      console.log("Fetching NFTs...");
      const allNFTs = await fetchAllDigitalAssetWithTokenByOwner(
        umi,
        ownerPublicKey
      );

      console.log(`Found ${allNFTs.length} NFTs for the owner:`);
      allNFTs.forEach((nft, index) => {
        console.log(`\nNFT #${index + 1}:`);
        console.log("Mint Address:", nft.publicKey);
        console.log("Name:", nft.metadata.name);
        console.log("Symbol:", nft.metadata.symbol);
        console.log("URI:", nft.metadata.uri);
      });

      // If you need the full NFT data
      console.log("\nFull NFT data:");
      console.log(JSON.stringify(allNFTs, null, 2));
    } catch (error) {
      console.error("Error:", error);
    }

    console.log('mint = ', mint);
    console.log('depositAddress = ', depositAddress);
    try {
      // Await the results of utils.token.associatedAddress
      const userTokenAccount = await utils.token.associatedAddress({
        mint: new PublicKey(mint),
        owner: walletPublicKey
      });

      const depositTokenAccount = await utils.token.associatedAddress({
        mint: new PublicKey(mint),
        owner: new PublicKey(depositAddress)
      });

      const tx = new Transaction();
      if (!(await connection.getAccountInfo(depositTokenAccount))) {
        console.log("tx 1 ", tx)
        const createIx = createAssociatedTokenAccountInstruction(
          walletPublicKey,
          depositTokenAccount,
          new PublicKey(depositAddress),
          new PublicKey(mint)
        );
        tx.add(createIx);
      }

      // Create a transaction
      tx.add(
        createTransferCheckedInstruction(
          userTokenAccount,
          new PublicKey(mint),
          depositTokenAccount,
          walletPublicKey,
          amountPlay,
          6, // Decimals
          [] // Signers (if any)
        )
      );

      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight },
      } = await connection.getLatestBlockhashAndContext();
      try {
        console.log("tx", tx);
        const rawSignature = await sendTransaction(tx, connection, {
          minContextSlot,
        });
        const signature = {
          rawSignature,
          blockhash,
          lastValidBlockHeight,
        };
        try {
          console.log('signature1 = ', signature)
          const response = await axios.post('/api/game/join', {
            params: signature,
            amount: amountPlay,
            baseAmount: amount,
          });
          console.log("join response:", response.data);
          if (response.status === 200) {
            if (level == 1) {

            } else if (level == 2) {

            } else if (level == 4) {

            } else if (level == 10) {

            } else if (level == 20) {

            }
          } else {
            console.log(`frontend Received status: ${response.status}`);
          }
        } catch (error) {
          console.error("join failed:", error);
        }
      } catch (error) {
        console.error(error);
        return false;
      }
    } catch (error) {
      console.error('Error in handleTransfer:', error);
    }
  }

  async function endClick() {
    console.log('end Button clicked!');
    try {
      const playerNum = 10;
      const level = 10;
      const response = await axios.post('/api/game/end', {
        walletAddress1, level, playerNum
      });
      console.log("join response:", response.data);
      if (response.status === 200) {
        //Luka end game
      } else {
        console.log(`frontend Received status: ${response.status}`);
      }
    } catch (error) {
      console.error("end failed:", error);
    }
  };

  // async function NFTClick() {
  //   console.log('end Button clicked!');
  //   if (!publicKey) {
  //     return;
  //   }

  //   let walletId = publicKey.toBase58();
  //   let nftUrl = `https://api.shyft.to/sol/v1/nft/read_all?network=devnet&address=${walletId}`;
  //   const xKey = 'https://devnet-rpc.shyft.to?api_key=RhBGkJsvyaDB8kqk'

  //   try {
  //   useEffect(() => {
  //     axios({
  //       // Endpoint to get NFTs
  //       url: nftUrl,
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "x-api-key": xKey,
  //       },
  //     })
  //       // Handle the response from backend here
  //       .then((res) => {
  //         console.log(res.data);
  //         if (res.data.success === true) {
  //           console.log('NFT = ', res.data.result);
  //         } 
  //       })
  //       // Catch errors if any
  //       .catch((err) => {
  //         console.warn(err);

  //       });
  //     }, [walletId]);
  //   } catch (error) {
  //     console.error("end failed:", error);
  //   }
  // };

  return (
    <div>
      <AppHero title="Dopa Game" subtitle="join game" />
      <div className="flex flex-wrap -m-2">
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={handleTransferBeginner}
          >
            Beginner lounge
          </button>
        </div>
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={handleTransferCasual}
          >
            Casual Lounge
          </button>
        </div>
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={handleTransferCompetitive}
          >
            Competitive lounge
          </button>
        </div>
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={handleTransferElite}
          >
            elite lounge
          </button>
        </div>
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={handleTransferRollers}
          >
            High rollers lounge
          </button>
        </div>
        <div className="p-2 w-full">
          <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={endClick}
          >
            end
          </button>
        </div>
        <div className="p-2 w-full">
          {/* <button
            type="submit"
            className="flex mx-auto text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            onClick={NFTClick}
          >
            NFT
          </button> */}
        </div>
      </div>
    </div>
  )
}