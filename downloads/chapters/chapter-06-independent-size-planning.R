# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: independent-size-planning
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

alpha <- .05
target_power <- .90
delta <- .5
sigma_plan <- .8
allocation_ratio <- 1.4
z_sum <- qnorm(1-alpha/2)+qnorm(target_power)
# Normal approximations provide starting values, not exact t-test power.
n_equal_z <- 2*sigma_plan^2*z_sum^2/delta^2
n1_ratio_z <- sigma_plan^2*(1+1/allocation_ratio)*z_sum^2/delta^2
# This model assumes independent normal groups with a common population SD.
power_two <- function(n1,n2) {
  df <- n1+n2-2
  ncp <- delta/(sigma_plan*sqrt(1/n1+1/n2))
  critical <- qt(1-alpha/2,df=df)
  pt(-critical,df=df,ncp=ncp)+
    pt(critical,df=df,ncp=ncp,lower.tail=FALSE)
}
# The returned n is the number in each group, not the total.
equal_plan <- power.t.test(n=NULL,delta=delta,sd=sigma_plan,
                          sig.level=alpha,power=target_power,
                          type="two.sample",alternative="two.sided",
                          strict=TRUE,tol=1e-10)
n_equal <- ceiling(equal_plan$n)
equal_check <- data.frame(n1=c(n_equal-1,n_equal),
                          n2=c(n_equal-1,n_equal))
equal_check$power <- mapply(power_two,equal_check$n1,equal_check$n2)
# Define the integer allocation rule before searching the candidate designs.
ratio_check <- data.frame(n1=2:200)
ratio_check$n2 <- ceiling(allocation_ratio*ratio_check$n1)
ratio_check$power <- mapply(power_two,ratio_check$n1,ratio_check$n2)
first <- which(ratio_check$power>=target_power)[1]
ratio_plan <- ratio_check[first,]
print(c(normal_equal=n_equal_z,normal_ratio_n1=n1_ratio_z,
        continuous_t_equal=equal_plan$n))
print(equal_check)
print(ratio_check[c(first-1,first),])
# An exact 7:5 ratio is a different integer constraint.
k <- 1:100
exact_ratio <- data.frame(n1=5*k,n2=7*k)
exact_ratio$power <- mapply(power_two,exact_ratio$n1,exact_ratio$n2)
exact_first <- which(exact_ratio$power>=target_power)[1]
print(exact_ratio[exact_first,])
# Independently compare the equal-group calculation with the R helper.
helper_power <- power.t.test(n=n_equal,delta=delta,sd=sigma_plan,
                            sig.level=alpha,type="two.sample",
                            alternative="two.sided",strict=TRUE)$power
stopifnot(n_equal==55,
          equal_check$power[1]<target_power,
          equal_check$power[2]>=target_power,
          abs(helper_power-power_two(n_equal,n_equal))<1e-12,
          ratio_plan$n1==47,ratio_plan$n2==66,
          all(ratio_check$power[seq_len(first-1)]<target_power),
          exact_ratio$n1[exact_first]==50,
          exact_ratio$n2[exact_first]==70)
