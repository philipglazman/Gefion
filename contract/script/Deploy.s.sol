// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../SteamGameEscrow.sol";
import "../SteamOwnershipVerifier.sol";
import "../SteamGameVerifier.sol";
import "../MockUSDC.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy SteamOwnershipVerifier with the TLSNotary notary address
        // This is the real notary address derived from the TLSNotary public key
        address notaryAddress = 0x8d2742456c331C5b61997229AAB28F57f7A87227;
        SteamOwnershipVerifier ownershipVerifier = new SteamOwnershipVerifier(notaryAddress);
        console.log("SteamOwnershipVerifier deployed at:", address(ownershipVerifier));

        // Deploy a temporary escrow with msg.sender as verifier (will update after)
        SteamGameEscrow escrow = new SteamGameEscrow(address(usdc), msg.sender);
        console.log("SteamGameEscrow deployed at:", address(escrow));

        // Deploy SteamGameVerifier wiring ownership verifier and escrow together
        SteamGameVerifier gameVerifier = new SteamGameVerifier(
            address(ownershipVerifier),
            address(escrow)
        );
        console.log("SteamGameVerifier deployed at:", address(gameVerifier));

        // Transfer verifier role to the SteamGameVerifier contract
        escrow.setVerifier(address(gameVerifier));
        console.log("Escrow verifier set to SteamGameVerifier");

        // Mint some USDC to test accounts
        // Anvil accounts 1-4 get 10,000 USDC each
        address[4] memory testAccounts = [
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,
            0x90F79bf6EB2c4f870365E785982E1f101E93b906,
            0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
        ];

        for (uint i = 0; i < testAccounts.length; i++) {
            usdc.mint(testAccounts[i], 10_000 * 1e6);
            console.log("Minted 10,000 USDC to:", testAccounts[i]);
        }

        vm.stopBroadcast();

        // Log addresses for manual config update
        console.log("=== Contract Addresses ===");
        console.log("USDC:", address(usdc));
        console.log("OwnershipVerifier:", address(ownershipVerifier));
        console.log("Escrow:", address(escrow));
        console.log("GameVerifier:", address(gameVerifier));
        console.log("=========================");
    }
}
