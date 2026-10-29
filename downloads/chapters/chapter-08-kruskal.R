# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: kruskal
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Use the same nine original observations as the ANOVA example.
d <- data.frame(group=factor(rep(c("A", "B", "C"), each=3)),
                y=c(4, 5, 6, 7, 8, 9, 10, 11, 12))
d$rank <- rank(d$y)
aggregate(rank ~ group, data=d, FUN=sum)
kruskal.test(y ~ group, data=d)
# Welch ANOVA keeps the population-mean target and estimates separate variances.
oneway.test(y ~ group, data=d, var.equal=FALSE)
