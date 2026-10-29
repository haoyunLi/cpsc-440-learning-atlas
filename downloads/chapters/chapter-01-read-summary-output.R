# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 01, section: read-summary-output
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(8, 9, 10, 10, 11, 12, 14, 30)
# Keep measurement units in the analysis notes.
c(n=length(y), mean=mean(y), median=median(y),
  variance=var(y), sd=sd(y), se=sd(y)/sqrt(length(y)))
# Declare the quantile convention explicitly.
quantile(y, c(.25, .5, .75), type=7)
# Display every observation alongside the box plot.
boxplot(y, ylab="Height (cm)")
stripchart(y, method="jitter", vertical=TRUE, add=TRUE,
           pch=16, col="steelblue")
