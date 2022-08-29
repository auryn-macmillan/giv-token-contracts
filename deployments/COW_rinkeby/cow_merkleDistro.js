/* eslint-disable no-useless-concat */
const hre = require("hardhat");
const { ethers } = hre;
const { upgrades } = hre;
const fs = require("fs");
const { BigNumber } = require("ethers");

const args = process.argv.slice(2);

async function main() {
    const deployer = (await ethers.getSigners())[0].address;
    /*
        Parameters
        MerkleDistro: 50000000
        duration: 126144000
        startTime: 1644584715
        InitialPercentage: 0
        Cliff: 0
    */
    const startTime = args[0];
    const cliffPeriod = 0;
    const duration = 126144000;
    const initialPercentage = 0;
    const tokenAddress = ethers.utils.getAddress(args[1]); // Token Address second parameter
    const totalTokens = ethers.utils.parseEther(args[2]);
    const cancelable = true;
    const LMDuration = 1_209_600; //  (TEST: 2 weeks = 24 hours => 86_400) final -> 2 weeks * 7 days * 24 hours * 3600 seconds = 1_209_600
    // eslint-disable-next-line camelcase
    const merkletree_file = "./files/COW_vesting_rinkeby_result.json";
    const data = JSON.parse(fs.readFileSync(merkletree_file));
    const merkleTokens = ethers.utils.formatEther(
        BigNumber.from(data.tokenTotal).toString(),
    );

    console.log("\n#######################");
    console.log("##### Deployments #####");
    console.log("#######################");
    console.log("Deployer:", deployer);
    console.log(
        "totalTokens:",
        ethers.utils.formatEther(totalTokens.toString()),
    );
    console.log("startTime:", startTime);
    console.log("cliffPeriod:", cliffPeriod);
    console.log("duration:", duration);
    console.log("initialPercentage:", initialPercentage);
    console.log("tokenAddress:", tokenAddress);
    console.log("LMDuration:", LMDuration);
    console.log("cancelable:", cancelable);
    console.log("merkletree_file:", merkletree_file);
    console.log("merkleTokens:", merkleTokens);

    console.log("\n#######################");
    console.log("##### TokenDistro #####");
    console.log("#######################\n");

    console.log("deployer:", deployer);
    console.log(
        "totalTokens:",
        ethers.utils.formatEther(totalTokens.toString()),
    );
    console.log("startTime:", startTime);
    console.log("cliffPeriod:", cliffPeriod);
    console.log("duration:", duration);
    console.log("initialPercentage:", initialPercentage);
    console.log("tokenAddress:", tokenAddress);
    console.log("cancelable:", cancelable);

    // Deploy TokenDistro
    const TokenDistro = await ethers.getContractFactory("TokenDistro");
    const tokenDistro = await upgrades.deployProxy(TokenDistro, [
        totalTokens,
        startTime,
        cliffPeriod,
        duration,
        initialPercentage,
        tokenAddress,
        cancelable,
    ]);
    await tokenDistro.deployed();
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

    console.log("\n#######################");
    console.log("#####  Final checks ###");
    console.log("#######################");
    console.log(
        "tokenDistro.balances(tokenDistro.address)",
        "allocated:",
        ethers.utils.formatEther(
            (
                await tokenDistro.balances(tokenDistro.address)
            ).allocatedTokens.toString(),
        ),
        "claimed:",
        ethers.utils.formatEther(
            (
                await tokenDistro.balances(tokenDistro.address)
            ).claimed.toString(),
        ),
    );
    console.log(
        "tokenDistro.balances(merkleDistro.address)",
        "allocated:",
        ethers.utils.formatEther(
            (
                await tokenDistro.balances(merkleDistro.address)
            ).allocatedTokens.toString(),
        ),
        "claimed:",
        ethers.utils.formatEther(
            (
                await tokenDistro.balances(merkleDistro.address)
            ).claimed.toString(),
        ),
    );
    console.log(
        "tokenDistro.hasRole(tokenDistro.DISTRIBUTOR_ROLE(),merkleDistro.address)",
        await tokenDistro.hasRole(
            tokenDistro.DISTRIBUTOR_ROLE(),
            merkleDistro.address,
        ),
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
