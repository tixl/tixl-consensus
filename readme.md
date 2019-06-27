# Note

This should be considered a prototype which is WIP. The consensus algorithm is only one part of the Tixl core. We decided to make it open source because we don't see a significant risk of somebody stealing the code and using it for another privacy coin. You will see a lot of commits in this repository over the next weeks. We think that combined with the commit messages of the other repositories being pushed into Discord, a good overview of our technical progress is given.

## Federated Byzantine Agreement System
This repository currently implements a simulation of the Federated Byzantine Agreement System (FBAS), which is part of the Stellar Consensus Protocol (SCP) by David Mazières. The network is emulated via a server and websockets, in practice the network layer will of course be different. All messages of all client are distributed to all clients via the server. The interface let's you choose quorum slices. Any node can start a new instance of FBAS on a topic, which it automatically votes yes for. Other nodes / clients participate by clicking on vote and select a choice. The clients will determine quorums and blocking sets to accept and confirm values.

## Running locally
- `yarn` in both folders
- `yarn start` in both folders

In practice you will want to open more than one tab of the client to have multiple nodes running.