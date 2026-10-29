# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: paired-size-planning
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

alpha <- .05
target_power <- .90
delta <- .5
sd_before <- .8
sd_after <- .8
rho_plan <- .6
sd_difference <- function(rho) {
  sqrt(sd_before^2+sd_after^2-2*rho*sd_before*sd_after)
}
# n counts independent pairs; sd_d describes within-pair differences.
power_paired <- function(n,sd_d) {
  df <- n-1
  ncp <- delta*sqrt(n)/sd_d
  critical <- qt(1-alpha/2,df=df)
  pt(-critical,df=df,ncp=ncp)+
    pt(critical,df=df,ncp=ncp,lower.tail=FALSE)
}
sd_d <- sd_difference(rho_plan)
z_n <- sd_d^2*(qnorm(1-alpha/2)+qnorm(target_power))^2/delta^2
plan <- power.t.test(n=NULL,delta=delta,sd=sd_d,sig.level=alpha,
                     power=target_power,type="paired",
                     alternative="two.sided",strict=TRUE,tol=1e-10)
n_pairs <- ceiling(plan$n)
check <- data.frame(pairs=c(n_pairs-1,n_pairs))
check$df <- check$pairs-1
check$power <- vapply(check$pairs,power_paired,numeric(1),sd_d=sd_d)
print(c(sd_difference=sd_d,normal_n=z_n,continuous_t_n=plan$n,
        complete_pairs=n_pairs,measurements=2*n_pairs))
print(check)
# Re-plan at several plausible correlations without changing the target effect.
rhos <- c(0,.3,.6,.8)
sensitivity <- do.call(rbind,lapply(rhos,function(rho) {
  candidate_sd <- sd_difference(rho)
  candidate <- power.t.test(n=NULL,delta=delta,sd=candidate_sd,
                           sig.level=alpha,power=target_power,type="paired",
                           alternative="two.sided",strict=TRUE,tol=1e-10)
  candidate_n <- ceiling(candidate$n)
  achieved <- power_paired(candidate_n,candidate_sd)
  previous <- power_paired(candidate_n-1,candidate_sd)
  stopifnot(previous<target_power,achieved>=target_power)
  data.frame(rho=rho,sd_difference=candidate_sd,pairs=candidate_n,
             power_at_planned_n=achieved,
             power_if_only_24=power_paired(24,candidate_sd))
}))
print(sensitivity)
# Check the noncentral-t formula against the independent R implementation.
helper_power <- power.t.test(n=n_pairs,delta=delta,sd=sd_d,
                            sig.level=alpha,type="paired",
                            alternative="two.sided",strict=TRUE)$power
stopifnot(n_pairs==24,
          check$power[1]<target_power,check$power[2]>=target_power,
          abs(helper_power-check$power[2])<1e-12,
          identical(sensitivity$pairs,c(56,40,24,13)))
