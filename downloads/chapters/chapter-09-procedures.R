# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: procedures
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reuse the original three-group ANOVA data, with all three pairs as the family.
d <- data.frame(group=factor(rep(c("A", "B", "C"), each=3)),
                y=c(4, 5, 6, 7, 8, 9, 10, 11, 12))
fit <- aov(y ~ group, data=d)
summary(fit)
TukeyHSD(fit, which="group", conf.level=.95)
# pool.sd=TRUE uses one residual SD pooled across all groups.
pairwise.t.test(d$y, d$group, alternative="two.sided",
                p.adjust.method="bonferroni", pool.sd=TRUE)
