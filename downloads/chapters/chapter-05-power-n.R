# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: power-n
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

mu0 <- 50
mua <- 54
sigma_plan <- 6
alpha <- .05
target_power <- .80
delta <- mua-mu0
# Specify the one-sample, one-sided design explicitly.
plan <- power.t.test(n=NULL,delta=delta,sd=sigma_plan,sig.level=alpha,
                     power=target_power,type="one.sample",
                     alternative="one.sided",tol=1e-10)
n_plan <- ceiling(plan$n)
# Recompute power from the noncentral t distribution at integer n.
power_at <- function(n) {
  df <- n-1
  critical <- qt(1-alpha,df=df)
  ncp <- delta*sqrt(n)/sigma_plan
  pt(critical,df=df,ncp=ncp,lower.tail=FALSE)
}
candidate_n <- c(n_plan-1,n_plan)
check <- data.frame(n=candidate_n,df=candidate_n-1,
                    power=vapply(candidate_n,power_at,numeric(1)))
print(c(continuous_solution=plan$n,planned_n=n_plan))
print(check)
stopifnot(n_plan==16,
          check$power[1] < target_power,
          check$power[2] >= target_power,
          abs(check$power[2]-.81556641112424) < 1e-12)
