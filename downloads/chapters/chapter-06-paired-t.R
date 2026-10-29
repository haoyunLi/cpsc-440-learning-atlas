# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: paired-t
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Construct paired values with differences B - A = 1, 2, 3, 2, 2.
before <- c(10, 20, 30, 40, 50)
after <- c(11, 22, 33, 42, 52)
difference <- after - before
c(mean_difference=mean(difference), variance=var(difference),
  SE=sd(difference)/sqrt(length(difference)))
t.test(after, before, paired=TRUE, alternative="two.sided", mu=0)
# A one-sample test of the differences gives the same result.
t.test(difference, alternative="two.sided", mu=0)
