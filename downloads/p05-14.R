planning <- power.t.test(delta=3,sd=5,sig.level=.05,power=.8,
                         type="one.sample",alternative="one.sided")
answer <- ceiling(planning$n)
ns <- c(answer-1,answer)
power <- sapply(ns,function(n) power.t.test(n=n,delta=3,sd=5,sig.level=.05,
                  type="one.sample",alternative="one.sided")$power)
print(planning)
print(data.frame(n=ns,power=power))
stopifnot(power[1]<.8,power[2]>=.8)
