alpha <- .05
target_power <- .80
delta <- 2
sd_before <- 3
sd_after <- 3
rho <- .25
sd_d <- sqrt(sd_before^2+sd_after^2-2*rho*sd_before*sd_after)
# The sd argument describes differences; n counts complete pairs.
plan <- power.t.test(n=NULL,delta=delta,sd=sd_d,sig.level=alpha,
                     power=target_power,type="paired",
                     alternative="two.sided",strict=TRUE,tol=1e-10)
answer <- ceiling(plan$n)
ns <- c(answer-1,answer)
power <- vapply(ns,function(n) {
  df <- n-1
  ncp <- delta*sqrt(n)/sd_d
  critical <- qt(1-alpha/2,df=df)
  pt(-critical,df=df,ncp=ncp)+
    pt(critical,df=df,ncp=ncp,lower.tail=FALSE)
},numeric(1))
print(c(sd_difference=sd_d,continuous_n=plan$n,complete_pairs=answer))
print(data.frame(pairs=ns,power=power))
stopifnot(answer==29,power[1]<target_power,power[2]>=target_power)
