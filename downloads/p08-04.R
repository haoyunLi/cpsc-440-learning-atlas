y <- c(1,2,3,4, 3,4,5,6, 7,8,9,10, 2,5,9,15)
g <- factor(rep(LETTERS[1:4],each=4))
kruskal.test(y ~ g)
boxplot(y ~ g)
