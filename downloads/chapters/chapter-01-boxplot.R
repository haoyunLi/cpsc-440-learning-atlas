# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 01, section: boxplot
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Teaching observations from the worked example above
y <- c(2, 3, 3, 4, 18)
# R: use type 7 explicitly to match this site's interactive examples
mean(y); median(y); var(y); sd(y)
quantile(y, c(.25,.5,.75), type=7)
hist(y, breaks=10); boxplot(y)
# SAS: PROC UNIVARIATE, PROC FREQ, PROC SGPLOT
