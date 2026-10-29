# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: paired-t
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original paired observations used in the chapter and interactive lab.
dat <- data.frame(id=paste0("P",1:5),
                  A=c(8,14,20,26,32), B=c(9,16,23,28,34))
dat$D <- dat$B-dat$A
n <- nrow(dat)
mean_D <- mean(dat$D)
sA2 <- var(dat$A)
sB2 <- var(dat$B)
sAB <- cov(dat$A,dat$B)
sD2 <- var(dat$D)
SE <- sqrt(sD2/n)
print(dat)
print(c(mean_D=mean_D,sA2=sA2,sB2=sB2,sAB=sAB,sD2=sD2,SE=SE))
stopifnot(abs(sD2-(sA2+sB2-2*sAB))<1e-12)

# A paired test equals a one-sample test of the actual within-pair differences.
paired <- t.test(dat$B,dat$A,paired=TRUE,alternative="two.sided",mu=0)
one_sample <- t.test(dat$D,alternative="two.sided",mu=0)
print(paired)
stopifnot(abs(paired$p.value-one_sample$p.value)<1e-12,
          max(abs(paired$conf.int-one_sample$conf.int))<1e-12)

# Moving complete rows preserves identities, differences and inference.
reordered <- dat[n:1,]
whole_rows <- t.test(reordered$B,reordered$A,paired=TRUE)
stopifnot(identical(sort(reordered$D),sort(dat$D)),
          abs(whole_rows$p.value-paired$p.value)<1e-12,
          max(abs(whole_rows$conf.int-paired$conf.int))<1e-12)

# Reversing B alone breaks the recorded pair IDs. This is an arithmetic
# demonstration, not an alternative valid analysis of these paired data.
wrong <- data.frame(A_id=dat$id,A=dat$A,B_id=rev(dat$id),B=rev(dat$B))
wrong$D <- wrong$B-wrong$A
print(wrong)
summary_row <- function(a,b) {
  c(mean_A=mean(a),mean_B=mean(b),mean_D=mean(b-a),
    sA2=var(a),sB2=var(b),sAB=cov(a,b),sD2=var(b-a),
    difference_SE=sqrt(var(b-a)/length(a)),
    independence_SE_benchmark=sqrt((var(a)+var(b))/length(a)))
}
comparison <- rbind(recorded=summary_row(dat$A,dat$B),
                    whole_rows=summary_row(reordered$A,reordered$B),
                    wrong_B_only=summary_row(wrong$A,wrong$B))
print(comparison,digits=10)
stopifnot(abs(var(wrong$D)-372.5)<1e-12,
          abs(cov(wrong$A,wrong$B)+93)<1e-12,
          all(comparison[,"mean_D"]==2),
          sum(wrong$A_id!=wrong$B_id)==4)
# The independence SE is a comparison of formulas, not a valid instruction
# to ignore the actual pairing. No test or CI is reported for the wrong mapping.
