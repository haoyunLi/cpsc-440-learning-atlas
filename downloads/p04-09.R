set.seed(440)
N <- 10000
both <- rbinom(N,1,0.6)*rbinom(N,1,0.6)
frequency <- cumsum(both)/seq_len(N)
plot(frequency,type="l",xlab="Trials",ylab="Cumulative frequency")
abline(h=0.36,col="red",lty=2)
frequency[c(10,100,1000,10000)]
