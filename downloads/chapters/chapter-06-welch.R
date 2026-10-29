# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: welch
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Constructed data matching the summary statistics above.
x <- c(10, 10, 12, 14, 14)
y <- c(4, 6, 8, 10, 10, 12, 14, 16)
rbind(x=c(n=length(x), mean=mean(x), variance=var(x)),
      y=c(n=length(y), mean=mean(y), variance=var(y)))
t.test(x, y, alternative="two.sided", mu=0)
# Pooled inference adds the equal-population-variance assumption.
t.test(x, y, alternative="two.sided", mu=0, var.equal=TRUE)
