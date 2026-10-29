alpha <- .05
target_power <- .80
delta <- 1
sigma_plan <- 2
# Evaluate the actual pooled t test for each integer allocation.
power_at <- function(nA,nB) {
  df <- nA+nB-2
  ncp <- delta/(sigma_plan*sqrt(1/nA+1/nB))
  critical <- qt(1-alpha/2,df=df)
  pt(-critical,df=df,ncp=ncp)+
    pt(critical,df=df,ncp=ncp,lower.tail=FALSE)
}
designs <- data.frame(nA=2:200)
designs$nB <- ceiling(1.5*designs$nA)
designs$power <- mapply(power_at,designs$nA,designs$nB)
first <- which(designs$power>=target_power)[1]
answer <- designs$nA[first]
print(designs[c(first-1,first),])
stopifnot(answer==53,designs$nB[first]==80,
          all(designs$power[seq_len(first-1)]<target_power))
