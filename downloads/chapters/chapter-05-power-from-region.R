# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: power-from-region
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

mu0 <- 50
mua <- 54
se <- 10/sqrt(25)
alpha <- .05
# Derive the rejection boundary under the null.
cut <- mu0 + qnorm(1-alpha)*se
power_right <- pnorm(cut, mean=mua, sd=se, lower.tail=FALSE)
# Include both rejection tails for an exact normal-model calculation.
limits <- mu0 + qnorm(c(alpha/2, 1-alpha/2))*se
power_two <- pnorm(limits[1],mua,se) +
  pnorm(limits[2],mua,se,lower.tail=FALSE)
c(power_right=power_right, power_two=power_two)
