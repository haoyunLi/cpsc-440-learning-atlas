# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: procedures
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Balanced normal groups with a common residual variance.
# Shared control and shared pooled MSE define the joint t distribution.
dunnett_cdf <- function(cut,m,df,two_sided=FALSE) {
  stopifnot(length(cut)==1L,m>=1,df>0)
  if(two_sided && cut<=0) return(0)
  integrand <- function(u) vapply(u,function(uu) {
    h <- cut*sqrt(2*uu/df)
    conditional <- function(z) {
      prob <- if(two_sided) pnorm(z+h)-pnorm(z-h) else pnorm(z+h)
      dnorm(z)*pmax(prob,0)^m
    }
    integrate(conditional,-Inf,Inf,rel.tol=1e-8,
              subdivisions=200L)$value*dchisq(uu,df)
  },numeric(1))
  value <- integrate(integrand,0,Inf,rel.tol=1e-7,
                     subdivisions=200L)$value
  min(1,max(0,value))
}
group_means <- c(control=10,A=12,B=14,C=16)
# Choose the control by its name, independently of factor ordering.
control <- "control"
active_names <- setdiff(names(group_means),control)
n <- 4
mse <- 4
m <- length(active_names)
error_df <- length(group_means)*(n-1)
alpha <- .05
# This bracket is adequate for m=3 and df=12.
critical_one <- uniroot(function(cut) {
  dunnett_cdf(cut,m,error_df)-(1-alpha)
},interval=c(1,4),tol=1e-7)$root
critical_two <- uniroot(function(cut) {
  dunnett_cdf(cut,m,error_df,TRUE)-(1-alpha)
},interval=c(1,4),tol=1e-7)$root
estimate <- group_means[active_names]-group_means[control]
se <- sqrt(2*mse/n)
t_obs <- estimate/se
# The prespecified analysis tests each active mean above the control.
p_adjusted <- vapply(t_obs,function(stat) {
  1-dunnett_cdf(stat,m,error_df)
},numeric(1))
lower <- estimate-critical_one*se
print(c(one_sided_critical=critical_one,two_sided_critical=critical_two,
        ordinary_one_sided_t=qt(1-alpha,error_df),SE=se))
print(data.frame(comparison=paste(names(estimate),"minus control"),
                 estimate=estimate,t=t_obs,lower=lower,upper=Inf,
                 adjusted_p=p_adjusted,reject=lower>0))
# A single comparison must reproduce the ordinary t CDF.
stopifnot(abs(dunnett_cdf(1.5,1,error_df)-pt(1.5,error_df))<1e-6,
          abs(critical_one-2.28732)<1e-4,
          abs(critical_two-2.68291)<1e-4)
