/* eslint-disable no-useless-concat */
const hre = require("hardhat");
const { ethers } = hre;
const { upgrades } = hre;
const fs = require("fs");
const { BigNumber } = require("ethers");

const args = process.argv.slice(2);

async function main() {
    const deployer = (await ethers.getSigners())[0].address;
    const tokenDistroAddress = args[0];
    // eslint-disable-next-line camelcase
    const merkletree_file = "./files/merkle_distributor_xdai_result.json";
    const data = JSON.parse(fs.readFileSync(merkletree_file));
    const merkleTokens = ethers.utils.formatEther(
        BigNumber.from(data.tokenTotal).div(10), // Note: divided by then because it's for testing purpose
    );

    console.log("merkletree_file:", merkletree_file);
    console.log("merkleTokens:", merkleTokens);

    // Deploy TokenDistro
    const TokenDistro = await ethers.getContractFactory("TokenDistro");
    const tokenDistro = TokenDistro.attach(tokenDistroAddress);
    console.log("########################\n");
    console.log("TokenDistro deployed to:", tokenDistro.address);
    console.log("\n#######################");
    console.log("#####    Check    #####");
    console.log("#######################");
    console.log(
        "TokenDistro - totalTokens:",
        `${ethers.utils.formatEther(await tokenDistro.totalTokens())}\n` +
            `TokenDistro - startTime:`,
        `${await tokenDistro.startTime()}\n` + `TokenDistro - cliffPeriod:`,
        `${await tokenDistro.cliffTime()}\n` + `TokenDistro - duration:`,
        `${await tokenDistro.duration()}\n` + `TokenDistro - initialAmount:`,
        `${await tokenDistro.initialAmount()}\n` + `TokenDistro - token:`,
        `${await tokenDistro.token()}\n` + `TokenDistro - cancelable:`,
        await tokenDistro.cancelable(),
    );

    console.log(
        "This smartcontract needs: ",
        ethers.utils.formatEther(await tokenDistro.totalTokens()),
        "Tokens",
    );
    console.log(
        `token.mint("${
            tokenDistro.address
        }","${await tokenDistro.totalTokens()}")`,
    );

    console.log("\n########################");
    console.log("##### MerkleDistro #####");
    console.log("########################\n");
    console.log("deployer:", deployer);
    console.log("distroAddress:", tokenDistro.address);
    console.log("merkletree_file:", merkletree_file);

    const MerkleDistro = await ethers.getContractFactory("MerkleDistro");
    const merkleDistro = await upgrades.deployProxy(MerkleDistro, [
        tokenDistro.address,
        data.merkleRoot,
    ]);
    await merkleDistro.deployed();
    console.log("#######################\n");
    console.log("MerkleDistro deployed to:", merkleDistro.address);
    console.log("\n#######################\n");

    // We grant permisions to the MerkleDistro and assign tokens
    await (
        await tokenDistro.grantRole(
            tokenDistro.DISTRIBUTOR_ROLE(),
            merkleDistro.address,
        )
    ).wait();
    console.log(
        "TokenDistro - assign: MerkleDistro",
        ethers.utils.parseEther(merkleTokens.toString()).toString(),
    );
    await (
        await tokenDistro.assign(
            merkleDistro.address,
            ethers.utils.parseEther(merkleTokens.toString()),
        )
    ).wait();

    console.log("\n#######################");
    console.log("#####    Check    #####");
    console.log("#######################");
    console.log(
        "MerkleDistro - _tokenDistro:",
        `${await merkleDistro.tokenDistro()}\n` + `MerkleDistro - _merkleRoot:`,
        `${await merkleDistro.merkleRoot()}\n`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
