// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../SteamGameEscrow.sol";
import "../MockUSDC.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy Escrow (deployer is also verifier for now)
        address verifier = msg.sender;
        SteamGameEscrow escrow = new SteamGameEscrow(address(usdc), verifier);
        console.log("SteamGameEscrow deployed at:", address(escrow));

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

        // Write addresses to file for backend to read
        string memory json = string(abi.encodePacked(
            '{"usdc":"', vm.toString(address(usdc)),
            '","escrow":"', vm.toString(address(escrow)),
            '","verifier":"', vm.toString(verifier), '"}'
        ));
        vm.writeFile("../backend/src/config/contracts.json", json);
        console.log("Contract addresses written to backend/src/config/contracts.json");
    }
}
