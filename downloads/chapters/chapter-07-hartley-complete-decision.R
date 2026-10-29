# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: hartley-complete-decision
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# CDF of the ratio of the largest to smallest independent chi-square.
# Equal group sizes are required for this common-df construction.
fmax_cdf <- function(r,k,df) {
  stopifnot(length(r)==1L,k >= 2,df > 0)
  if (r <= 1) return(0)
  value <- integrate(function(x) {
    interval_prob <- pmax(pchisq(r*x,df)-pchisq(x,df),0)
    k*dchisq(x,df)*interval_prob^(k-1)
  },lower=0,upper=Inf,rel.tol=1e-10,subdivisions=1000L)$value
  min(1,max(0,value))
}
sample_variances <- c(4,9,16)
k <- length(sample_variances)
n <- 10
nu <- n-1
observed_fmax <- max(sample_variances)/min(sample_variances)
p_value <- 1-fmax_cdf(observed_fmax,k,nu)
# The upper bracket is chosen for this k=3, df=9 example.
critical <- uniroot(function(r) fmax_cdf(r,k,nu)-.95,
                    interval=c(1,100),tol=1e-9)$root
c(Fmax=observed_fmax,p_value=p_value,critical_95=critical)
stopifnot(abs(p_value-.1203008) < 1e-6,
          abs(critical-5.3384579) < 1e-6)
