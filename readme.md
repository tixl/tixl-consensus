# Note

This should be considered a prototype which is WIP. The consensus algorithm is only one part of the Tixl core. We decided to make it open source because we don't see a significant risk of somebody stealing the code and using it for another privacy coin. You will see a lot of commits in this repository over the next weeks. We think that combined with the commit messages of the other repositories being pushed into Discord, a good overview of our technical progress is given.

## Messages
1. Cast vote for value V: I am Node N, my quorum slices are Q, and I vote V

 If it can see a quorum of peers that all vote for V also, then it can move to accepting V
2. I am Node N, my quorum slices are Q, and I accept V

 N can accept a different value, W, even if N didn’t vote for it, and even if it doesn’t see a quorum voting for it, as long as it sees a blocking set accepting it. A blocking set is just one node chosen from each of N’s quorum slices. As its name suggests, it is capable of blocking any other value. If all nodes in such a set accept W, then (by Theorem 8) it will never be possible to form a quorum accepting not-W, and so it’s safe for N to accept W too.

3. But a blocking set is not a quorum. It would be too easy for someone to fool node N into accepting a value when it shouldn’t, if they can just subvert one node in each of N’s slices. So accepting a value is not the end of voting. Instead, N must confirm the value, meaning it sees a quorum of nodes all accepting it. If it gets this far, then as the SCP whitepaper proves (in Theorem 11), the rest of the network will also eventually confirm the same value, and so N has reached the end of federated voting with the value as its outcome.
