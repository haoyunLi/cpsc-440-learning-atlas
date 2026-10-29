# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: student
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the course example from its reported summary statistics
n <- 9
ybar <- 0.4564
s <- 0.2128
mu0 <- 0.3
alpha <- 0.01
se <- s / sqrt(n)
t_obs <- (ybar - mu0) / se
p_value <- pt(t_obs, df=n-1, lower.tail=FALSE)
lower <- ybar - qt(1-alpha, df=n-1) * se
c(t=t_obs, df=n-1, p=p_value, lower_99=lower)
# A one-sided confidence interval has this lower endpoint and upper endpoint Inf.
# With raw observations y, use t.test(y, mu=mu0, alternative="greater", conf.level=.99).
