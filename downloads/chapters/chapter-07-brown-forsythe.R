# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: brown-forsythe
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the two groups in the worked example.
d <- data.frame(group=factor(rep(c("A", "B"), each=3)),
                y=c(2, 3, 4, 1, 3, 5))
d$group_median <- ave(d$y, d$group, FUN=median)
d$z <- abs(d$y - d$group_median)
d
aggregate(z ~ group, data=d, FUN=mean)
summary(aov(z ~ group, data=d))
