import React, { useEffect, useState } from "react";
import { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { Profile as ProfileType } from "../lib/social";
import { ProfileEditForm } from "./ProfileEditForm";
import App from "../App";

export function DevWrapper() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [wallet, setWallet] = useState<NearWalletBase | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");

  useEffect(() => {
    // Initialize NearConnector
    const initWallet = async () => {
      try {
        const connector = new NearConnector({
          manifest: "/manifest.json",
          network,
          providers: { testnet: ["https://relmn.aurora.dev"] },

          walletConnect: {
            projectId: "1292473190ce7eb75c9de67e15aaad99", // Replace with your project ID
            metadata: {
              name: "Web4 Profile Template",
              description: "Profile editing for Web4",
              url: window.location.origin,
              icons: ["/favicon.ico"],
            },
          },
        });

        connector.on("wallet:signIn", async (t) => {
          setWallet(await connector.wallet());
          setConnectedId(t.accounts[0]?.accountId || null);
        });

        connector.on("wallet:signOut", () => {
          setWallet(null);
          setConnectedId(null);
        });

        // Check if already connected
        const currentWallet = await connector.wallet();
        const accounts = await currentWallet.getAccounts();
        if (accounts[0]) {
          setWallet(currentWallet);
          setConnectedId(accounts[0].accountId);
        }

        // Store connector in a ref or state for use in handleConnect
        (window as any).__connector = connector;
      } catch (error) {
        console.error("Failed to initialize wallet connector:", error);
      }
    };

    initWallet();
  }, [network]);

  const handleConnect = async () => {
    if (connectedId) {
      // Disconnect
      const connector = (window as any).__connector;
      if (connector) {
        await connector.disconnect();
      }
    } else {
      // Connect
      const connector = (window as any).__connector;
      if (connector) {
        await connector.connect();
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setIsDevToolsOpen(false);
  };

  const toggleDevTools = () => {
    setIsDevToolsOpen(!isDevToolsOpen);
  };

  return (
    <div className="relative min-h-screen">
      {/* Dev Tools Toggle Button */}
      <button
        onClick={toggleDevTools}
        className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition-all hover:bg-gray-800"
      >
        ⚙️
      </button>

      {/* Dev Tools Panel */}
      <div
        className={`fixed right-4 top-16 z-50 flex flex-col gap-2 overflow-hidden transition-all duration-300 ${
          isDevToolsOpen ? "h-auto opacity-100" : "h-0 opacity-0"
        }`}
      >
        {connectedId ? (
          <div className="rounded bg-green-500 px-4 py-2 text-white shadow">
            Connected: {connectedId}
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="rounded bg-blue-500 px-4 py-2 text-white shadow hover:bg-blue-600"
          >
            Connect Wallet
          </button>
        )}
        <button
          onClick={handleEdit}
          className="rounded bg-gray-500 px-4 py-2 text-white shadow hover:bg-gray-600"
        >
          Edit Profile
        </button>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-start bg-white md:items-center md:bg-black md:bg-opacity-50">
          <div className="h-full w-full overflow-y-auto bg-white p-4 md:mx-auto md:h-auto md:max-h-[90vh] md:w-[90vw] md:max-w-4xl md:rounded-lg md:p-8">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-4">
              <h1 className="text-2xl font-bold">Edit Profile</h1>
              <button
                onClick={() => setIsEditing(false)}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="mt-4">
              <ProfileEditForm
                profile={profile}
                onSave={async (newProfile) => {
                  if (!wallet) {
                    console.error("Wallet not connected");
                    return;
                  }

                  if (!connectedId) {
                    alert("No wallet connected. Please connect your wallet first.");
                    return;
                  }

                  try {
                    // Save profile to NEAR social contract
                    const data = {
                      [connectedId]: {
                        profile: {
                          name: newProfile.name,
                          description: newProfile.description,
                          image: newProfile.image,
                          backgroundImage: newProfile.backgroundImage,
                          linktree: newProfile.linktree,
                        },
                      },
                    };

                    await wallet.signAndSendTransaction({
                      signerId: connectedId,
                      receiverId: "social.near",
                      actions: [
                        {
                          type: "FunctionCall",
                          params: {
                            methodName: "set",
                            args: { data },
                            gas: "300000000000000",
                            deposit: "0",
                          },
                        },
                      ],
                    });

                    setProfile(newProfile);
                    setIsEditing(false);
                    alert("Profile saved successfully!");
                  } catch (error) {
                    console.error("Failed to save profile:", error);
                    alert("Failed to save profile. Please try again.");
                  }
                }}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* App Component - Router handles the Profile rendering */}
      <App />
    </div>
  );
}
