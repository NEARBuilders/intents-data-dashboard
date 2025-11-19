"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc, queryClient, SERVER_URL } from "@/utils/orpc";
import { ModeToggle } from "./mode-toggle";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DevConfigManager, type CustomRpcConfig } from "@/lib/dev-config";
import { toast } from "sonner";

export default function Header() {
	const [devMode, setDevMode] = useState(false);
	const [rpcUrl, setRpcUrl] = useState("");
	const [currentUrl, setCurrentUrl] = useState("");

	const apiHealthcheck = useQuery(orpc.health.queryOptions());
	const isConnected = apiHealthcheck.data === "OK";

	useEffect(() => {
		const config = DevConfigManager.getConfig();
		if (config) {
			setRpcUrl(config.url);
			setDevMode(config.enabled);
		}
		updateCurrentUrl();
	}, []);

	function updateCurrentUrl() {
		const config = DevConfigManager.getConfig();
		if (config?.enabled && config?.url) {
			setCurrentUrl(`${config.url}/api/rpc`);
		} else {
			setCurrentUrl(`${SERVER_URL}/api/rpc`);
		}
	}

	function handleDevModeToggle(enabled: boolean) {
		if (!enabled) {
			setDevMode(false);
			DevConfigManager.clearConfig();
			updateCurrentUrl();
			queryClient.invalidateQueries();
			toast.info("Dev mode disabled");
		} else {
			setDevMode(true);
			if (rpcUrl.trim()) {
				const config: CustomRpcConfig = {
					url: rpcUrl.trim(),
					enabled: true,
				};
				DevConfigManager.saveConfig(config);
				updateCurrentUrl();
				queryClient.invalidateQueries();
				toast.info("Dev mode enabled");
			}
		}
	}

	function handleSave() {
		if (!rpcUrl.trim()) {
			toast.error("Please enter a valid RPC URL");
			return;
		}

		const config: CustomRpcConfig = {
			url: rpcUrl.trim(),
			enabled: devMode,
		};

		DevConfigManager.saveConfig(config);
		updateCurrentUrl();
		queryClient.invalidateQueries();
		toast.success(`Custom RPC URL saved`);
	}

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-6 py-3">
				<h1 className="text-xl font-semibold">Data Provider Playground</h1>

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<div
							className={`h-2 w-2 rounded-full ${
								isConnected ? "bg-green-500" : "bg-red-500"
							}`}
						/>
						<span className="text-sm">
							{apiHealthcheck.isLoading ? "Checking..." : isConnected ? "Connected" : "Disconnected"}
						</span>
					</div>

					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="gap-2">
								<Switch checked={devMode} onCheckedChange={handleDevModeToggle} />
								<span>Dev Mode</span>
							</Button>
						</PopoverTrigger>
					w	<PopoverContent className="w-80" align="end">
							<div className="space-y-4">
								<div>
									<h4 className="font-medium mb-2">Custom RPC URL</h4>
									<p className="text-sm text-muted-foreground mb-3">
										Configure a custom RPC endpoint for testing
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="rpc-url">Base URL</Label>
									<Input
										id="rpc-url"
										type="url"
										placeholder="http://localhost:3014"
										value={rpcUrl}
										onChange={(e) => setRpcUrl(e.target.value)}
										disabled={!devMode}
									/>
								</div>
								<div className="p-3 bg-muted rounded text-xs">
									<p className="font-medium mb-1">Current URL:</p>
									<p className="font-mono text-muted-foreground break-all">
										{currentUrl || `${SERVER_URL}/api/rpc`}
									</p>
								</div>
								<Button onClick={handleSave} disabled={!devMode} className="w-full">
									Save Configuration
								</Button>
							</div>
						</PopoverContent>
					</Popover>

					<ModeToggle />
				</div>
			</div>
			<hr />
			{devMode && (
				<div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-2">
					<p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
						⚠️ Dev Mode Active - Using custom RPC: {currentUrl}
					</p>
				</div>
			)}
		</div>
	);
}
