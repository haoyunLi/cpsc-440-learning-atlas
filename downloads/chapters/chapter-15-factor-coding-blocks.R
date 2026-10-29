# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: factor-coding-blocks
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

d <- data.frame(
  treatment=rep(1:3,each=4),
  block=rep(1:4,times=3),
  y=c(7,10,13,14, 14,17,17,20, 9,9,12,14))
# Numeric codes would impose linear trends in the identifiers.
wrong_target <- lm(y ~ treatment + block,data=d)
df.residual(wrong_target)
# Convert categorical identifiers before fitting the RCBD.
d$treatment <- factor(d$treatment)
d$block <- factor(d$block)
fit <- aov(y ~ treatment + block,data=d)
summary(fit)
df.residual(fit)
# Check that every treatment occurs once in every block.
with(d,table(treatment,block))
